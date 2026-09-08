// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Pluggable DEX surface. Only adapters with real contracts may report available().
interface IDexAdapter {
    function version() external pure returns (string memory);
    function implemented() external pure returns (bool);
    function available() external view returns (bool);
}
