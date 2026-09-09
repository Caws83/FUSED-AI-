// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {CurrencySettler} from "@uniswap/v4-core/test/utils/CurrencySettler.sol";

import {LaunchToken} from "../core/LaunchToken.sol";
import {LaunchLocker} from "../core/LaunchLocker.sol";
import {FusedCurveMath} from "./FusedCurveMath.sol";

/// @title FusedFactory
/// @notice Create a token, trade a virtual-reserve bonding curve, then graduate into
/// Uniswap v4 with liquidity locked in an unmodified LaunchLocker.
///
/// OpenLaunch LaunchFactory is not used for creation. That contract launches
/// directly into Uniswap. This factory is the Fused AI lifecycle.
contract FusedFactory is ReentrancyGuard, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencySettler for Currency;

    uint8 public constant STATE_NONE = 0;
    uint8 public constant STATE_CURVE = 1;
    uint8 public constant STATE_GRADUATED = 2;

    uint16 public constant MAX_FEE_BPS = 100;
    uint24 public constant MAX_LP_FEE = 30_000;
    int24 public constant TICK_SPACING = 200;
    uint256 public constant DEFAULT_SUPPLY = 1_000_000_000e18;
    uint256 public constant BPS = 10_000;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    struct CurveParams {
        uint256 virtualQuote;
        uint256 virtualToken;
        uint256 graduationTarget;
        uint16 feeBps;
        address feeRecipient;
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
    LaunchLocker public immutable locker;
    uint256 public immutable virtualQuoteSeed;
    uint256 public immutable virtualTokenSeed;
    uint256 public immutable graduationTarget;
    uint16 public immutable feeBps;
    address public immutable feeRecipient;
    uint24 public immutable graduatedLpFee;

    mapping(address token => Market) internal _markets;
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

    error UnknownMarket();
    error NotCurve();
    error NotGraduated();
    error AlreadyGraduated();
    error NotReadyToGraduate();
    error DeadlineExpired();
    error Slippage();
    error BadFee();
    error BadCurve();
    error SaltUsed();
    error ZeroValue();

    uint8 internal constant VENUE_CURVE = 0;
    uint8 internal constant VENUE_V4 = 1;

    constructor(
        IPoolManager poolManager_,
        IPositionManager positionManager_,
        IAllowanceTransfer permit2_,
        CurveParams memory curve
    ) {
        if (curve.virtualQuote == 0 || curve.virtualToken == 0 || curve.graduationTarget == 0) revert BadCurve();
        if (curve.feeBps > MAX_FEE_BPS) revert BadFee();
        if (curve.feeBps > 0 && curve.feeRecipient == address(0)) revert BadFee();
        if (curve.lpFee > MAX_LP_FEE) revert BadFee();
        poolManager = poolManager_;
        positionManager = positionManager_;
        permit2 = permit2_;
        locker = new LaunchLocker(positionManager_);
        virtualQuoteSeed = curve.virtualQuote;
        virtualTokenSeed = curve.virtualToken;
        graduationTarget = curve.graduationTarget;
        feeBps = curve.feeBps;
        feeRecipient = curve.feeRecipient;
        graduatedLpFee = curve.lpFee;
    }

    receive() external payable {}

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

    function buy(address token, uint256 minTokensOut, uint256 deadline) external payable nonReentrant returns (uint256 tokensOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (msg.value == 0) revert ZeroValue();
        Market storage m = _markets[token];
        if (m.state == STATE_NONE) revert UnknownMarket();
        if (m.state == STATE_GRADUATED) {
            tokensOut = _swapV4(token, msg.sender, true, msg.value, minTokensOut);
        } else {
            tokensOut = _buyCurve(token, msg.sender, msg.value, minTokensOut);
        }
    }

    function sell(address token, uint256 tokenIn, uint256 minQuoteOut, uint256 deadline) external nonReentrant returns (uint256 quoteOut) {
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
        _graduate(token);
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
        uint256 fee = (quoteOut * feeBps) / BPS;
        quoteOut -= fee;
        newPriceX18 = FusedCurveMath.priceX18(nq, nt);
    }

    function poolKeyOf(address token) public view returns (PoolKey memory) {
        Market storage m = _markets[token];
        if (m.state == STATE_NONE) revert UnknownMarket();
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: m.lpFee,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert UnknownMarket();
        (address recipient, PoolKey memory key, SwapParams memory params) = abi.decode(raw, (address, PoolKey, SwapParams));
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

    function _buyCurve(address token, address trader, uint256 quoteIn, uint256 minTokensOut) internal returns (uint256 tokensOut) {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert NotCurve();
        uint256 fee = (quoteIn * feeBps) / BPS;
        uint256 net = quoteIn - fee;
        if (fee > 0) {
            (bool ok,) = feeRecipient.call{value: fee}("");
            require(ok, "fee");
        }
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
            _graduate(token);
        }
        return tokensOut;
    }

    function _sellCurve(address token, address trader, uint256 tokenIn, uint256 minQuoteOut) internal returns (uint256 quoteOut) {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert NotCurve();
        require(LaunchToken(token).transferFrom(trader, address(this), tokenIn), "xfer");
        uint256 newQ;
        uint256 newT;
        (quoteOut, newQ, newT) = FusedCurveMath.sellOut(m.virtualQuote, m.virtualToken, m.realQuote, tokenIn);
        uint256 fee = (quoteOut * feeBps) / BPS;
        uint256 net = quoteOut - fee;
        if (net < minQuoteOut) revert Slippage();
        m.virtualQuote = newQ;
        m.virtualToken = newT;
        m.realQuote -= quoteOut;
        m.realToken += tokenIn;
        m.circulating -= tokenIn;
        if (fee > 0) {
            (bool feeOk,) = feeRecipient.call{value: fee}("");
            require(feeOk, "fee");
        }
        (bool sendOk,) = trader.call{value: net}("");
        require(sendOk, "eth");
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

    function _graduate(address token) internal {
        Market storage m = _markets[token];
        if (m.state != STATE_CURVE) revert AlreadyGraduated();
        m.state = STATE_GRADUATED;

        uint256 ethLiq = m.realQuote;
        uint256 tokenLiq = m.realToken;
        if (ethLiq == 0 || tokenLiq == 0) revert NotReadyToGraduate();

        PoolKey memory key = poolKeyOf(token);
        uint160 sqrtPrice = FusedCurveMath.encodeSqrtRatioX96(m.virtualToken, m.virtualQuote);
        if (sqrtPrice < TickMath.MIN_SQRT_PRICE) sqrtPrice = TickMath.MIN_SQRT_PRICE + 1;
        if (sqrtPrice >= TickMath.MAX_SQRT_PRICE) sqrtPrice = TickMath.MAX_SQRT_PRICE - 1;
        poolManager.initialize(key, sqrtPrice);

        int24 tickLower = TickMath.minUsableTick(TICK_SPACING);
        int24 tickUpper = TickMath.maxUsableTick(TICK_SPACING);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPrice, TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), ethLiq, tokenLiq
        );
        if (liquidity == 0) revert NotReadyToGraduate();

        LaunchToken(token).approve(address(permit2), tokenLiq);
        permit2.approve(token, address(positionManager), uint160(tokenLiq), uint48(block.timestamp));

        uint256 tokenId = positionManager.nextTokenId();
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            key, tickLower, tickUpper, uint256(liquidity), uint128(ethLiq), uint128(tokenLiq), address(locker), bytes("")
        );
        params[1] = abi.encode(key.currency0, key.currency1);
        positionManager.modifyLiquidities{value: ethLiq}(abi.encode(actions, params), block.timestamp);

        LaunchToken(token).approve(address(permit2), 0);
        uint256 dust = LaunchToken(token).balanceOf(address(this));
        if (dust > 0) require(LaunchToken(token).transfer(DEAD, dust), "dust");

        LaunchLocker.Recipient[] memory burn = new LaunchLocker.Recipient[](1);
        burn[0] = LaunchLocker.Recipient({payout: DEAD, bps: uint16(locker.BPS())});
        locker.register(tokenId, token, address(0), burn);

        m.tokenId = tokenId;
        m.poolId = key.toId();
        m.realQuote = 0;
        m.realToken = 0;
        emit Graduated(token, tokenId, key.toId(), ethLiq, tokenLiq);
    }

    function _swapV4(address token, address trader, bool ethIn, uint256 amountIn, uint256 minOut)
        internal
        returns (uint256 amountOut)
    {
        Market storage m = _markets[token];
        if (m.state != STATE_GRADUATED) revert NotGraduated();
        PoolKey memory key = poolKeyOf(token);
        SwapParams memory params = SwapParams({
            zeroForOne: ethIn,
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: ethIn ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });
        if (!ethIn) {
            require(LaunchToken(token).transferFrom(trader, address(this), amountIn), "xfer");
        }
        bytes memory raw = poolManager.unlock(abi.encode(trader, key, params));
        BalanceDelta delta = abi.decode(raw, (BalanceDelta));
        if (ethIn) {
            amountOut = uint256(int256(delta.amount1()));
            if (amountOut < minOut) revert Slippage();
            uint256 spent = uint256(int256(-delta.amount0()));
            if (msg.value > spent) {
                (bool refundOk,) = trader.call{value: msg.value - spent}("");
                require(refundOk, "refund");
            }
            emit Trade(token, trader, true, spent, amountOut, 0, m.circulating, 0, VENUE_V4);
        } else {
            amountOut = uint256(int256(delta.amount0()));
            if (amountOut < minOut) revert Slippage();
            emit Trade(token, trader, false, amountOut, amountIn, 0, m.circulating, 0, VENUE_V4);
        }
        return amountOut;
    }

    function _netQuote(uint256 quoteIn) internal view returns (uint256) {
        uint256 fee = (quoteIn * feeBps) / BPS;
        return quoteIn - fee;
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
