// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {CurrencySettler} from "@uniswap/v4-core/test/utils/CurrencySettler.sol";

import {LaunchToken} from "../core/LaunchToken.sol";
import {FusedLocker} from "./FusedLocker.sol";
import {FusedCurveMath} from "./FusedCurveMath.sol";
import {FusedFeeMath} from "./FusedFeeMath.sol";
import {FusedUsdcConvert} from "./FusedUsdcConvert.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/// @title FusedFactoryArc
/// @notice Arc-only factory. Native 18-dec USDC curve via msg.value; ERC-20 6-dec USDC for V4.
/// Does not replace FusedFactoryV2. Robinhood must never deploy this contract.
contract FusedFactoryArc is ReentrancyGuard, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencySettler for Currency;
    using SafeERC20 for IERC20;

    uint8 public constant STATE_NONE = 0;
    uint8 public constant STATE_CURVE = 1;
    uint8 public constant STATE_GRADUATED = 2;

    uint16 public constant MAX_FEE_BPS = 100;
    uint16 public constant feeBps = MAX_FEE_BPS;
    uint16 public constant creatorFeeBps = 30;
    uint16 public constant treasuryFeeBps = 70;
    uint24 public constant MAX_LP_FEE = 30_000;
    int24 public constant TICK_SPACING = 200;
    uint256 public constant DEFAULT_SUPPLY = 1_000_000_000e18;
    uint256 public constant BPS = 10_000;
    uint256 public constant NATIVE_TO_ERC20 = 1e12;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    address public constant FUSED_TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;
    address public constant CANONICAL_USDC = 0x3600000000000000000000000000000000000000;
    address public constant CANONICAL_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    uint256 internal constant ROBINHOOD_TESTNET = 46630;
    uint256 internal constant ROBINHOOD_MAINNET = 4663;
    uint256 internal constant ARC_TESTNET = 5042002;
    uint256 internal constant ARC_MAINNET = 5042;

    address internal constant ARC_MAINNET_POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant ARC_MAINNET_POSITION_MANAGER = 0x6049c9a0e26405C0985f9E3685C87d0aE917f82B;

    struct CurveParams {
        uint256 virtualQuote;
        uint256 virtualToken;
        uint256 graduationTarget;
        address treasury;
        uint24 lpFee;
    }

    struct CreateParams {
        string name;
        string symbol;
        string metadataURI;
        bytes32 salt;
        uint256 minTokensOut;
        uint256 deadline;
    }

    struct Market {
        address creator;
        uint8 state;
        uint256 virtualQuote;
        uint256 virtualToken;
        uint256 realQuote;
        uint256 realToken;
        uint256 totalSupply;
        uint256 circulating;
        uint256 graduationTarget;
        uint256 tokenId;
        uint256 createdAt;
        uint24 lpFee;
        PoolId poolId;
    }

    struct MarketView {
        address creator;
        uint8 state;
        uint256 virtualQuote;
        uint256 virtualToken;
        uint256 realQuote;
        uint256 realToken;
        uint256 totalSupply;
        uint256 circulating;
        uint256 graduationTarget;
        uint256 tokenId;
        uint256 createdAt;
        uint24 lpFee;
        uint256 priceX18;
        uint256 progressBps;
    }

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;
    IAllowanceTransfer public immutable permit2;
    FusedLocker public immutable locker;
    address public immutable treasury;
    address public immutable quoteToken;
    uint256 public immutable virtualQuoteSeed;
    uint256 public immutable virtualTokenSeed;
    uint256 public immutable graduationTarget;
    uint24 public immutable graduatedLpFee;

    mapping(address token => Market) internal _markets;
    mapping(address account => uint256) public claimable;
    mapping(address token => bool) public graduationReadyEmitted;
    uint256 public reservedFees;
    uint256 public launchCount;

    event Created(
        address indexed token,
        address indexed creator,
        uint256 supply,
        uint256 virtualQuote,
        uint256 virtualToken,
        uint256 graduationTarget,
        string metadataURI
    );
    event Trade(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 quoteAmount,
        uint256 tokenAmount,
        uint256 priceX18,
        uint256 circulating,
        uint256 realQuote,
        uint8 venue
    );
    event Graduated(
        address indexed token,
        uint256 indexed tokenId,
        PoolId poolId,
        uint256 quoteLiquidity,
        uint256 tokenLiquidity
    );
    event GraduationReady(address indexed token, uint256 realQuote, uint256 quoteLiq6);
    event FeeAccrued(address indexed token, address indexed creator, uint256 creatorShare, uint256 treasuryShare);
    event Claimed(address indexed account, uint256 amount);

    error UnknownMarket();
    error NotCurve();
    error NotGraduated();
    error AlreadyGraduated();
    error NotReadyToGraduate();
    error DeadlineExpired();
    error Slippage();
    error BadFee();
    error BadCurve();
    error BadTreasury();
    error BadQuoteToken();
    error BadDexConfig();
    error UnsupportedChain();
    error DexUnavailable();
    error SaltUsed();
    error ZeroValue();
    error QuoteTransferFailed();
    error Insolvency();
    error InsufficientQuoteToken();
    error NativeNotAcceptedAfterGraduation();

    uint8 internal constant VENUE_CURVE = 0;
    uint8 internal constant VENUE_V4 = 1;

    constructor(
        IPoolManager poolManager_,
        IPositionManager positionManager_,
        IAllowanceTransfer permit2_,
        CurveParams memory curve,
        address quoteToken_
    ) {
        uint256 id = block.chainid;
        if (id == ROBINHOOD_TESTNET || id == ROBINHOOD_MAINNET) revert UnsupportedChain();
        if (curve.virtualQuote == 0 || curve.virtualToken == 0 || curve.graduationTarget == 0) revert BadCurve();
        if (curve.treasury != FUSED_TREASURY) revert BadTreasury();
        if (curve.lpFee > MAX_LP_FEE) revert BadFee();
        if (quoteToken_ == address(0) || quoteToken_ == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)) {
            revert BadQuoteToken();
        }

        bool anyDex = address(poolManager_) != address(0) || address(positionManager_) != address(0)
            || address(permit2_) != address(0);
        bool allDex = address(poolManager_) != address(0) && address(positionManager_) != address(0)
            && address(permit2_) != address(0);
        if (anyDex != allDex) revert BadDexConfig();

        if (id == ARC_TESTNET) {
            if (anyDex) revert DexUnavailable();
            if (quoteToken_ != CANONICAL_USDC) revert BadQuoteToken();
        }
        if (id == ARC_MAINNET) {
            if (!allDex) revert DexUnavailable();
            if (quoteToken_ != CANONICAL_USDC) revert BadQuoteToken();
            if (address(poolManager_) != ARC_MAINNET_POOL_MANAGER) revert BadDexConfig();
            if (address(positionManager_) != ARC_MAINNET_POSITION_MANAGER) revert BadDexConfig();
            if (address(permit2_) != CANONICAL_PERMIT2) revert BadDexConfig();
        }

        if (quoteToken_.code.length != 0 && IERC20Decimals(quoteToken_).decimals() != 6) revert BadQuoteToken();

        poolManager = poolManager_;
        positionManager = positionManager_;
        permit2 = permit2_;
        locker = new FusedLocker(poolManager_, positionManager_, permit2_);
        treasury = curve.treasury;
        quoteToken = quoteToken_;
        virtualQuoteSeed = curve.virtualQuote;
        virtualTokenSeed = curve.virtualToken;
        graduationTarget = curve.graduationTarget;
        graduatedLpFee = curve.lpFee;
    }

    receive() external payable {}

    function dexEnabled() public view returns (bool) {
        return address(poolManager) != address(0) && address(positionManager) != address(0)
            && address(permit2) != address(0);
    }

    function isGraduationReady(address token) public view returns (bool) {
        Market storage m = _markets[token];
        return m.state == STATE_CURVE && m.realQuote >= m.graduationTarget;
    }

    function create(CreateParams calldata p) external payable nonReentrant returns (address token) {
        if (block.timestamp > p.deadline) revert DeadlineExpired();
        uint256 supply = DEFAULT_SUPPLY;
        bytes32 salt = keccak256(abi.encode(msg.sender, p.salt));
        address predicted = _predict(salt, p.name, p.symbol, supply, msg.sender, p.metadataURI);
        if (predicted.code.length != 0) revert SaltUsed();
        token = address(new LaunchToken{salt: salt}(p.name, p.symbol, supply, msg.sender, p.metadataURI));

        Market storage m = _markets[token];
        m.creator = msg.sender;
        m.state = STATE_CURVE;
        m.virtualQuote = virtualQuoteSeed;
        m.virtualToken = virtualTokenSeed;
        m.realToken = supply;
        m.totalSupply = supply;
        m.graduationTarget = graduationTarget;
        m.createdAt = block.timestamp;
        m.lpFee = graduatedLpFee;
        unchecked {
            ++launchCount;
        }
        emit Created(token, msg.sender, supply, virtualQuoteSeed, virtualTokenSeed, graduationTarget, p.metadataURI);

        if (msg.value > 0) {
            _buyCurve(token, msg.sender, msg.value, p.minTokensOut);
        }
    }

    function buy(address token, uint256 minTokensOut, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (block.timestamp > deadline) revert DeadlineExpired();
        Market storage m = _markets[token];
        if (m.state == STATE_NONE) revert UnknownMarket();
        if (m.state == STATE_GRADUATED) {
            if (msg.value != 0) revert NativeNotAcceptedAfterGraduation();
            revert DexUnavailable();
        }
        if (msg.value == 0) revert ZeroValue();
        tokensOut = _buyCurve(token, msg.sender, msg.value, minTokensOut);
    }

    function buyExactQuote(address token, uint256 quoteIn, uint256 minTokensOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (quoteIn == 0) revert ZeroValue();
        Market storage m = _markets[token];
        if (m.state == STATE_NONE) revert UnknownMarket();
        if (m.state != STATE_GRADUATED) revert NotGraduated();
        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), quoteIn);
        tokensOut = _swapV4(token, msg.sender, true, quoteIn, minTokensOut);
    }

    function sell(address token, uint256 tokenIn, uint256 minQuoteOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (tokenIn == 0) revert ZeroValue();
        Market storage m = _markets[token];
        if (m.state == STATE_NONE) revert UnknownMarket();
        if (m.state == STATE_GRADUATED) {
            quoteOut = _swapV4(token, msg.sender, false, tokenIn, minQuoteOut);
        } else {
            quoteOut = _sellCurve(token, msg.sender, tokenIn, minQuoteOut);
        }
    }

    function graduate(address token) external nonReentrant {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert NotCurve();
        if (m.realQuote < m.graduationTarget) revert NotReadyToGraduate();
        if (!dexEnabled()) revert DexUnavailable();
        _graduate(token);
    }

    function claim() external nonReentrant returns (uint256) {
        return _claim(msg.sender);
    }

    function claimFor(address account) external nonReentrant returns (uint256) {
        return _claim(account);
    }

    function getMarket(address token) external view returns (MarketView memory v) {
        Market storage m = _markets[token];
        v.creator = m.creator;
        v.state = m.state;
        v.virtualQuote = m.virtualQuote;
        v.virtualToken = m.virtualToken;
        v.realQuote = m.realQuote;
        v.realToken = m.realToken;
        v.totalSupply = m.totalSupply;
        v.circulating = m.circulating;
        v.graduationTarget = m.graduationTarget;
        v.tokenId = m.tokenId;
        v.createdAt = m.createdAt;
        v.lpFee = m.lpFee;
        v.priceX18 = FusedCurveMath.priceX18(m.virtualQuote, m.virtualToken);
        v.progressBps = FusedCurveMath.progressBps(m.realQuote, m.graduationTarget);
    }

    function creatorOf(address token) external view returns (address) {
        Market storage m = _markets[token];
        if (m.state == STATE_NONE) revert UnknownMarket();
        return m.creator;
    }

    function quoteBuy(address token, uint256 quoteIn) external view returns (uint256 tokensOut, uint256 newPriceX18) {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert NotCurve();
        uint256 net = _netQuote(quoteIn);
        uint256 nq;
        uint256 nt;
        (tokensOut, nq, nt) = FusedCurveMath.buyOut(m.virtualQuote, m.virtualToken, m.realToken, net);
        newPriceX18 = FusedCurveMath.priceX18(nq, nt);
    }

    function quoteSell(address token, uint256 tokenIn) external view returns (uint256 quoteOut, uint256 newPriceX18) {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert NotCurve();
        uint256 nq;
        uint256 nt;
        (quoteOut, nq, nt) = FusedCurveMath.sellOut(m.virtualQuote, m.virtualToken, m.realQuote, tokenIn);
        (uint256 fee,,) = FusedFeeMath.curveFee(quoteOut);
        quoteOut -= fee;
        newPriceX18 = FusedCurveMath.priceX18(nq, nt);
    }

    function poolKeyOf(address token) public view returns (PoolKey memory) {
        Market storage m = _markets[token];
        if (m.state == STATE_NONE) revert UnknownMarket();
        if (!dexEnabled()) revert DexUnavailable();
        if (quoteToken == address(0)) revert BadQuoteToken();
        bool quoteIs0 = quoteToken < token;
        return PoolKey({
            currency0: Currency.wrap(quoteIs0 ? quoteToken : token),
            currency1: Currency.wrap(quoteIs0 ? token : quoteToken),
            fee: m.lpFee,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager) || address(poolManager) == address(0)) revert UnknownMarket();
        (address recipient, PoolKey memory key, SwapParams memory params) =
            abi.decode(raw, (address, PoolKey, SwapParams));
        BalanceDelta delta = poolManager.swap(key, params, "");
        if (delta.amount0() < 0) {
            key.currency0.settle(poolManager, address(this), uint256(int256(-delta.amount0())), false);
        }
        if (delta.amount1() < 0) {
            key.currency1.settle(poolManager, address(this), uint256(int256(-delta.amount1())), false);
        }
        if (delta.amount0() > 0) {
            key.currency0.take(poolManager, recipient, uint256(int256(delta.amount0())), false);
        }
        if (delta.amount1() > 0) {
            key.currency1.take(poolManager, recipient, uint256(int256(delta.amount1())), false);
        }
        return abi.encode(delta);
    }

    function _buyCurve(address token, address trader, uint256 quoteIn, uint256 minTokensOut)
        internal
        returns (uint256 tokensOut)
    {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert NotCurve();
        uint256 fee = _accrue(token, m.creator, quoteIn);
        uint256 net = quoteIn - fee;
        uint256 newQ;
        uint256 newT;
        (tokensOut, newQ, newT) = FusedCurveMath.buyOut(m.virtualQuote, m.virtualToken, m.realToken, net);
        if (tokensOut < minTokensOut) revert Slippage();
        m.virtualQuote = newQ;
        m.virtualToken = newT;
        m.realQuote += net;
        m.realToken -= tokensOut;
        m.circulating += tokensOut;
        require(LaunchToken(token).transfer(trader, tokensOut), "xfer");
        emit Trade(
            token,
            trader,
            true,
            net,
            tokensOut,
            FusedCurveMath.priceX18(m.virtualQuote, m.virtualToken),
            m.circulating,
            m.realQuote,
            VENUE_CURVE
        );
        if (m.realQuote >= m.graduationTarget) {
            if (dexEnabled()) {
                _graduate(token);
            } else {
                _markGraduationReady(token);
            }
        }
        return tokensOut;
    }

    function _sellCurve(address token, address trader, uint256 tokenIn, uint256 minQuoteOut)
        internal
        returns (uint256 quoteOut)
    {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert NotCurve();
        require(LaunchToken(token).transferFrom(trader, address(this), tokenIn), "xfer");
        uint256 newQ;
        uint256 newT;
        (quoteOut, newQ, newT) = FusedCurveMath.sellOut(m.virtualQuote, m.virtualToken, m.realQuote, tokenIn);
        uint256 fee = _accrue(token, m.creator, quoteOut);
        uint256 net = quoteOut - fee;
        if (net < minQuoteOut) revert Slippage();
        m.virtualQuote = newQ;
        m.virtualToken = newT;
        m.realQuote -= quoteOut;
        m.realToken += tokenIn;
        m.circulating -= tokenIn;
        (bool sendOk,) = trader.call{value: net}("");
        require(sendOk, "usdc");
        emit Trade(
            token,
            trader,
            false,
            net,
            tokenIn,
            FusedCurveMath.priceX18(m.virtualQuote, m.virtualToken),
            m.circulating,
            m.realQuote,
            VENUE_CURVE
        );
        return net;
    }

    function _markGraduationReady(address token) internal {
        Market storage m = _markets[token];
        if (graduationReadyEmitted[token]) return;
        graduationReadyEmitted[token] = true;
        emit GraduationReady(token, m.realQuote, FusedUsdcConvert.toErc20(m.realQuote));
    }

    function _graduate(address token) internal {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert AlreadyGraduated();
        if (!dexEnabled()) revert DexUnavailable();
        uint256 nativeLiq = m.realQuote;
        uint256 tokenLiq = m.realToken;
        if (nativeLiq == 0 || tokenLiq == 0) revert NotReadyToGraduate();
        if (address(this).balance < nativeLiq + reservedFees) revert Insolvency();

        uint256 quoteLiq6 = FusedUsdcConvert.requireErc20(nativeLiq);
        if (IERC20(quoteToken).balanceOf(address(this)) < quoteLiq6) revert InsufficientQuoteToken();

        PoolKey memory key = poolKeyOf(token);
        if (Currency.unwrap(key.currency0) == address(0) || Currency.unwrap(key.currency1) == address(0)) {
            revert BadQuoteToken();
        }

        bool quoteIs0 = quoteToken < token;
        uint160 sqrtPrice = _sqrtPrice(token, m.virtualQuote, m.virtualToken);

        m.state = STATE_GRADUATED;
        poolManager.initialize(key, sqrtPrice);

        int24 tickLower = TickMath.minUsableTick(TICK_SPACING);
        int24 tickUpper = TickMath.maxUsableTick(TICK_SPACING);
        uint256 amount0 = quoteIs0 ? quoteLiq6 : tokenLiq;
        uint256 amount1 = quoteIs0 ? tokenLiq : quoteLiq6;
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPrice, TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), amount0, amount1
        );
        if (liquidity == 0) revert NotReadyToGraduate();

        _approvePermit2(quoteToken, quoteLiq6);
        _approvePermit2(token, tokenLiq);

        uint256 tokenId = positionManager.nextTokenId();
        bytes memory actions =
            abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            key,
            tickLower,
            tickUpper,
            uint256(liquidity),
            uint128(amount0),
            uint128(amount1),
            address(locker),
            bytes("")
        );
        params[1] = abi.encode(key.currency0, key.currency1);
        params[2] = abi.encode(Currency.wrap(quoteToken), address(this));
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        IERC20(quoteToken).forceApprove(address(permit2), 0);
        LaunchToken(token).approve(address(permit2), 0);
        uint256 dust = LaunchToken(token).balanceOf(address(this));
        if (dust > 0) require(LaunchToken(token).transfer(DEAD, dust), "dust");

        locker.register(tokenId, token, quoteToken, m.creator, treasury);

        m.tokenId = tokenId;
        m.poolId = key.toId();
        m.realQuote = 0;
        m.realToken = 0;
        emit Graduated(token, tokenId, key.toId(), quoteLiq6, tokenLiq);
    }

    function _approvePermit2(address asset, uint256 amount) internal {
        IERC20(asset).forceApprove(address(permit2), amount);
        permit2.approve(asset, address(positionManager), uint160(amount), uint48(block.timestamp + 60));
    }

    function _swapV4(address token, address trader, bool quoteIn, uint256 amountIn, uint256 minOut)
        internal
        returns (uint256 amountOut)
    {
        Market storage m = _markets[token];
        if (m.state != STATE_GRADUATED) revert NotGraduated();
        if (!dexEnabled()) revert DexUnavailable();
        PoolKey memory key = poolKeyOf(token);
        bool quoteIs0 = quoteToken < token;
        bool zeroForOne = quoteIn ? quoteIs0 : !quoteIs0;
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });
        if (!quoteIn) {
            require(LaunchToken(token).transferFrom(trader, address(this), amountIn), "xfer");
        }
        bytes memory raw = poolManager.unlock(abi.encode(trader, key, params));
        BalanceDelta delta = abi.decode(raw, (BalanceDelta));
        uint256 spent;
        if (zeroForOne) {
            spent = uint256(int256(-delta.amount0()));
            amountOut = uint256(int256(delta.amount1()));
        } else {
            spent = uint256(int256(-delta.amount1()));
            amountOut = uint256(int256(delta.amount0()));
        }
        if (amountOut < minOut) revert Slippage();
        if (quoteIn && amountIn > spent && spent > 0) {
            IERC20(quoteToken).safeTransfer(trader, amountIn - spent);
        }
        emit Trade(token, trader, quoteIn, quoteIn ? spent : amountOut, quoteIn ? amountOut : amountIn, 0, m.circulating, 0, VENUE_V4);
        return amountOut;
    }

    function _accrue(address token, address creator, uint256 amount) internal returns (uint256 total) {
        uint256 creatorShare;
        uint256 treasuryShare;
        (total, creatorShare, treasuryShare) = FusedFeeMath.curveFee(amount);
        if (total == 0) return 0;
        claimable[creator] += creatorShare;
        claimable[treasury] += treasuryShare;
        reservedFees += total;
        emit FeeAccrued(token, creator, creatorShare, treasuryShare);
    }

    function _claim(address account) internal returns (uint256 amount) {
        amount = claimable[account];
        if (amount == 0) return 0;
        claimable[account] = 0;
        reservedFees -= amount;
        (bool ok,) = account.call{value: amount}("");
        if (!ok) revert QuoteTransferFailed();
        emit Claimed(account, amount);
    }

    function _netQuote(uint256 quoteIn) internal pure returns (uint256) {
        (uint256 fee,,) = FusedFeeMath.curveFee(quoteIn);
        return quoteIn - fee;
    }

    /// @dev Pool is 6-dec USDC vs 18-dec token. Encode from 18-dec curve reserves, then scale by 1e6.
    function _sqrtPrice(address token, uint256 virtualQuote18, uint256 virtualToken) internal view returns (uint160) {
        bool quoteIs0 = quoteToken < token;
        uint160 base = quoteIs0
            ? FusedCurveMath.encodeSqrtRatioX96(virtualToken, virtualQuote18)
            : FusedCurveMath.encodeSqrtRatioX96(virtualQuote18, virtualToken);
        uint256 adjusted = quoteIs0 ? uint256(base) * 1e6 : uint256(base) / 1e6;
        if (adjusted <= TickMath.MIN_SQRT_PRICE) return TickMath.MIN_SQRT_PRICE + 1;
        if (adjusted >= TickMath.MAX_SQRT_PRICE) return TickMath.MAX_SQRT_PRICE - 1;
        return uint160(adjusted);
    }

    function _predict(
        bytes32 scopedSalt,
        string memory name,
        string memory symbol,
        uint256 supply,
        address launcher,
        string memory metadataURI
    ) internal view returns (address) {
        bytes32 initHash = keccak256(
            abi.encodePacked(type(LaunchToken).creationCode, abi.encode(name, symbol, supply, launcher, metadataURI))
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), scopedSalt, initHash)))));
    }
}
