// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {PositionInfo} from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import {FusedFeeMath} from "./FusedFeeMath.sol";

interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title FusedLocker
/// @notice V2 locker: collects 1% V4 LP fees and splits 70% creator / 10% treasury / 20% LP compound.
/// Principal liquidity cannot be withdrawn or transferred. V1 LaunchLocker is unchanged.
contract FusedLocker is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    struct Position {
        address token;
        address quote;
        address creator;
        address treasury;
    }

    uint256 public constant BPS = 10_000;
    address public constant NATIVE = address(0);

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;
    IAllowanceTransfer public immutable permit2;
    address public immutable factory;

    mapping(uint256 tokenId => Position) internal _positions;
    mapping(address token => uint256 tokenId) public tokenIdOf;
    mapping(address account => mapping(address currency => uint256)) public claimable;
    mapping(address currency => uint256) public reserved;
    mapping(uint256 tokenId => mapping(address currency => uint256)) public compoundCarry;

    event Registered(uint256 indexed tokenId, address indexed token, address indexed creator, address treasury);
    event Collected(uint256 indexed tokenId, address indexed token, uint256 quoteAmount, uint256 tokenAmount);
    event Credited(address indexed account, address indexed currency, uint256 amount);
    event Claimed(address indexed account, address indexed currency, uint256 amount);
    event Paid(uint256 indexed tokenId, address indexed account, address indexed currency, uint256 amount);
    event Compounded(uint256 indexed tokenId, uint128 liquidity, uint256 quoteUsed, uint256 tokenUsed);

    error NotFactory();
    error OnlySelf();
    error AlreadyRegistered();
    error UnknownPosition();
    error NotPositionOwner();
    error BadRecipients();
    error EthTransferFailed();

    constructor(IPoolManager poolManager_, IPositionManager positionManager_, IAllowanceTransfer permit2_) {
        poolManager = poolManager_;
        positionManager = positionManager_;
        permit2 = permit2_;
        factory = msg.sender;
    }

    receive() external payable {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function register(uint256 tokenId, address token, address quote, address creator, address treasury) external {
        if (msg.sender != factory) revert NotFactory();
        if (_positions[tokenId].token != address(0) || tokenIdOf[token] != 0) revert AlreadyRegistered();
        if (IERC721Owner(address(positionManager)).ownerOf(tokenId) != address(this)) revert NotPositionOwner();
        if (creator == address(0) || treasury == address(0)) revert BadRecipients();

        Position storage p = _positions[tokenId];
        p.token = token;
        p.quote = quote;
        p.creator = creator;
        p.treasury = treasury;
        tokenIdOf[token] = tokenId;
        emit Registered(tokenId, token, creator, treasury);
    }

    function collect(uint256 tokenId) public nonReentrant returns (uint256 quoteOut, uint256 tokenOut) {
        Position storage p = _positions[tokenId];
        address token = p.token;
        if (token == address(0)) revert UnknownPosition();
        address quote = p.quote;

        bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(tokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(Currency.wrap(quote), Currency.wrap(token), address(this));
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        quoteOut = _free(quote);
        tokenOut = _free(token);

        (uint256 creatorQuote, uint256 treasuryQuote, uint256 compoundQuote) = FusedFeeMath.v4Split(quoteOut);
        (uint256 creatorToken, uint256 treasuryToken, uint256 compoundToken) = FusedFeeMath.v4Split(tokenOut);

        uint256 quoteCarry = compoundCarry[tokenId][quote];
        uint256 tokenCarry = compoundCarry[tokenId][token];
        compoundQuote += quoteCarry;
        compoundToken += tokenCarry;
        reserved[quote] -= quoteCarry;
        reserved[token] -= tokenCarry;
        compoundCarry[tokenId][quote] = 0;
        compoundCarry[tokenId][token] = 0;

        _payOrCredit(tokenId, quote, p.creator, creatorQuote);
        _payOrCredit(tokenId, quote, p.treasury, treasuryQuote);
        _payOrCredit(tokenId, token, p.creator, creatorToken);
        _payOrCredit(tokenId, token, p.treasury, treasuryToken);

        try this.executeCompound(tokenId, quote, token, compoundQuote, compoundToken) {}
        catch {
            _carry(tokenId, quote, _free(quote));
            _carry(tokenId, token, _free(token));
        }
        emit Collected(tokenId, token, quoteOut, tokenOut);
    }

    /// @dev Called only via `this` from `collect`. Failed compounds credit leftovers instead of reverting trades.
    function executeCompound(uint256 tokenId, address quote, address token, uint256 quoteAmt, uint256 tokenAmt)
        external
    {
        if (msg.sender != address(this)) revert OnlySelf();
        _compound(tokenId, quote, token, quoteAmt, tokenAmt);
    }

    function collectMany(uint256[] calldata tokenIds) external {
        for (uint256 i; i < tokenIds.length; ++i) {
            collect(tokenIds[i]);
        }
    }

    function claim(address currency) external nonReentrant returns (uint256) {
        return _claim(msg.sender, currency);
    }

    function claimFor(address account, address currency) external nonReentrant returns (uint256) {
        return _claim(account, currency);
    }

    function tokenOf(uint256 tokenId) external view returns (address) {
        return _positions[tokenId].token;
    }

    function quoteOf(uint256 tokenId) external view returns (address) {
        return _positions[tokenId].quote;
    }

    function creatorOf(uint256 tokenId) external view returns (address) {
        return _positions[tokenId].creator;
    }

    function treasuryOf(uint256 tokenId) external view returns (address) {
        return _positions[tokenId].treasury;
    }

    function _free(address currency) internal view returns (uint256) {
        uint256 bal = currency == NATIVE ? address(this).balance : IERC20(currency).balanceOf(address(this));
        return bal - reserved[currency];
    }

    function _payOrCredit(uint256 tokenId, address currency, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (_tryPay(currency, to, amount)) {
            emit Paid(tokenId, to, currency, amount);
        } else {
            _credit(to, currency, amount);
            reserved[currency] += amount;
        }
    }

    function _compound(uint256 tokenId, address quote, address token, uint256 quoteAmt, uint256 tokenAmt) internal {
        if (quoteAmt == 0 && tokenAmt == 0) return;
        uint256 freeQuote = _free(quote);
        uint256 freeToken = _free(token);
        if (quoteAmt > freeQuote) quoteAmt = freeQuote;
        if (tokenAmt > freeToken) tokenAmt = freeToken;
        if (quoteAmt == 0 && tokenAmt == 0) return;

        (PoolKey memory key, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
        (uint160 sqrtPrice,,,) = poolManager.getSlot0(key.toId());
        uint256 amount0 = Currency.unwrap(key.currency0) == quote ? quoteAmt : tokenAmt;
        uint256 amount1 = Currency.unwrap(key.currency0) == quote ? tokenAmt : quoteAmt;
        if (amount0 > type(uint128).max) amount0 = type(uint128).max;
        if (amount1 > type(uint128).max) amount1 = type(uint128).max;
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPrice,
            TickMath.getSqrtPriceAtTick(info.tickLower()),
            TickMath.getSqrtPriceAtTick(info.tickUpper()),
            amount0,
            amount1
        );
        if (liquidity == 0) {
            _carry(tokenId, quote, _free(quote));
            _carry(tokenId, token, _free(token));
            return;
        }
        if (tokenAmt > 0) {
            IERC20(token).approve(address(permit2), tokenAmt);
            permit2.approve(token, address(positionManager), uint160(tokenAmt), uint48(block.timestamp + 60));
        }
        uint128 liqBefore = positionManager.getPositionLiquidity(tokenId);
        uint256 quoteBefore = _free(quote);
        uint256 tokenBefore = _free(token);
        bytes memory actions =
            abi.encodePacked(uint8(Actions.INCREASE_LIQUIDITY), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, uint256(liquidity), uint128(amount0), uint128(amount1), bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1);
        params[2] = abi.encode(Currency.wrap(quote), address(this));
        positionManager.modifyLiquidities{value: quote == NATIVE ? quoteAmt : 0}(
            abi.encode(actions, params), block.timestamp
        );
        if (tokenAmt > 0) IERC20(token).approve(address(permit2), 0);
        uint256 quoteLeft = _free(quote);
        uint256 tokenLeft = _free(token);
        _carry(tokenId, quote, quoteLeft);
        _carry(tokenId, token, tokenLeft);
        uint128 liqAfter = positionManager.getPositionLiquidity(tokenId);
        emit Compounded(
            tokenId,
            liqAfter > liqBefore ? liqAfter - liqBefore : 0,
            quoteBefore - quoteLeft,
            tokenBefore - tokenLeft
        );
    }

    function _carry(uint256 tokenId, address currency, uint256 amount) internal {
        if (amount == 0) return;
        compoundCarry[tokenId][currency] += amount;
        reserved[currency] += amount;
    }

    function _tryPay(address currency, address to, uint256 amount) internal returns (bool ok) {
        if (amount == 0) return true;
        if (currency == NATIVE) {
            (ok,) = to.call{value: amount, gas: 50_000}("");
        } else {
            (bool called, bytes memory ret) =
                address(currency).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
            ok = called && (ret.length == 0 || abi.decode(ret, (bool)));
        }
    }

    function _credit(address account, address currency, uint256 amount) internal {
        if (amount == 0) return;
        claimable[account][currency] += amount;
        emit Credited(account, currency, amount);
    }

    function _claim(address account, address currency) internal returns (uint256 amount) {
        amount = claimable[account][currency];
        if (amount == 0) return 0;
        claimable[account][currency] = 0;
        reserved[currency] -= amount;
        if (currency == NATIVE) {
            (bool ok,) = account.call{value: amount}("");
            if (!ok) revert EthTransferFailed();
        } else {
            IERC20(currency).safeTransfer(account, amount);
        }
        emit Claimed(account, currency, amount);
    }
}
