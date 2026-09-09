// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title FusedCurveMath
/// @notice Constant-product virtual-reserve quotes. Rounding always favours the pool.
///
/// Pricing uses virtual reserves (x, y) with k = x * y:
///   buy  (quoteIn dx): tokensOut = y * dx / (x + dx)     // floor
///   sell (tokenIn dy): quoteOut  = x * dy / (y + dy)     // floor
///
/// Real ETH in the contract is tracked separately and is the graduation meter.
library FusedCurveMath {
    error ZeroAmount();
    error ZeroReserves();
    error InsufficientInventory();
    error InsufficientQuote();

    function buyOut(uint256 virtualQuote, uint256 virtualToken, uint256 realToken, uint256 quoteIn)
        internal
        pure
        returns (uint256 tokensOut, uint256 newVirtualQuote, uint256 newVirtualToken)
    {
        if (quoteIn == 0) revert ZeroAmount();
        if (virtualQuote == 0 || virtualToken == 0) revert ZeroReserves();
        newVirtualQuote = virtualQuote + quoteIn;
        tokensOut = (virtualToken * quoteIn) / newVirtualQuote;
        if (tokensOut == 0) revert ZeroAmount();
        if (tokensOut > realToken) revert InsufficientInventory();
        newVirtualToken = virtualToken - tokensOut;
    }

    function sellOut(uint256 virtualQuote, uint256 virtualToken, uint256 realQuote, uint256 tokenIn)
        internal
        pure
        returns (uint256 quoteOut, uint256 newVirtualQuote, uint256 newVirtualToken)
    {
        if (tokenIn == 0) revert ZeroAmount();
        if (virtualQuote == 0 || virtualToken == 0) revert ZeroReserves();
        newVirtualToken = virtualToken + tokenIn;
        quoteOut = (virtualQuote * tokenIn) / newVirtualToken;
        if (quoteOut == 0) revert ZeroAmount();
        if (quoteOut > realQuote) revert InsufficientQuote();
        newVirtualQuote = virtualQuote - quoteOut;
    }

    /// @notice ETH per token, 1e18 fixed-point (quoteWei * 1e18 / tokenWei).
    function priceX18(uint256 virtualQuote, uint256 virtualToken) internal pure returns (uint256) {
        if (virtualToken == 0) return 0;
        return (virtualQuote * 1e18) / virtualToken;
    }

    /// @notice Graduation progress in bps, capped at 10_000.
    function progressBps(uint256 realQuote, uint256 graduationTarget) internal pure returns (uint256) {
        if (graduationTarget == 0) return 0;
        uint256 bps = (realQuote * 10_000) / graduationTarget;
        return bps > 10_000 ? 10_000 : bps;
    }

    /// @notice sqrt(amount1/amount0) * 2^96 for Uniswap v4 initialize.
    function encodeSqrtRatioX96(uint256 amount1, uint256 amount0) internal pure returns (uint160) {
        if (amount0 == 0 || amount1 == 0) revert ZeroReserves();
        while (amount1 > 1e18 || amount0 > 1e18) {
            amount1 /= 10;
            amount0 /= 10;
        }
        if (amount0 == 0) revert ZeroReserves();
        uint256 ratioX192 = (amount1 << 192) / amount0;
        uint256 root = sqrt(ratioX192);
        if (root > type(uint160).max) revert ZeroReserves();
        if (root < 1) revert ZeroReserves();
        return uint160(root);
    }

    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256) {
        if (denominator == 0) revert ZeroReserves();
        unchecked {
            uint256 prod = a * b;
            if (a != 0 && prod / a != b) revert ZeroReserves();
            return prod / denominator;
        }
    }

    function sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        z = x;
        uint256 y = (x + 1) / 2;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
    }
}
