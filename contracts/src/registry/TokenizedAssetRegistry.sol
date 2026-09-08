// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Empty allowlist. Assets must be added through a verified governance/process later.
contract TokenizedAssetRegistry {
    struct Asset {
        uint256 chainId;
        address contractAddress;
        string issuer;
        string symbol;
        uint8 decimals;
        address feed;
        bool enabled;
    }

    mapping(uint256 => mapping(address => Asset)) internal assets;

    function isAllowlisted(uint256 chainId, address contractAddress) external view returns (bool) {
        return assets[chainId][contractAddress].enabled;
    }
}
