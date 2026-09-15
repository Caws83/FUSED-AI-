// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title FusedUsdcConvert
/// @notice Arc native USDC is 18-dec EVM accounting. Canonical ERC20 USDC is 6-dec.
/// Conversion always rounds down. Never mix the two units.
library FusedUsdcConvert {
    uint256 internal constant SCALE = 1e12;

    error ZeroOutputConversion();

    /// @notice 6-dec ERC20 amount from 18-dec native. Floors.
    function toErc20(uint256 amount18) internal pure returns (uint256) {
        return amount18 / SCALE;
    }

    /// @notice Remainder that cannot be represented in 6-dec ERC20.
    function dust18(uint256 amount18) internal pure returns (uint256) {
        return amount18 % SCALE;
    }

    /// @notice Same as toErc20 but reverts when the 6-dec result would be zero.
    function requireErc20(uint256 amount18) internal pure returns (uint256 amount6) {
        amount6 = amount18 / SCALE;
        if (amount6 == 0) revert ZeroOutputConversion();
    }

    function scale() internal pure returns (uint256) {
        return SCALE;
    }
}
