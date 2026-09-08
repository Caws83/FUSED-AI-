// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Allowlist of tokenized assets keyed by chain + contract. Tickers are not identifiers.
interface ITokenizedAssetRegistry {
    struct Asset {
        uint256 chainId;
        address contractAddress;
        string issuer;
        string symbol;
        uint8 decimals;
        address feed;
        bool enabled;
    }

    function isAllowlisted(uint256 chainId, address contractAddress) external view returns (bool);
    function get(uint256 chainId, address contractAddress) external view returns (Asset memory);
}
