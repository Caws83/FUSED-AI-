// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IDexAdapter} from "../interfaces/IDexAdapter.sol";

/// @dev Honest availability: Fused AI has not adopted production DEX contracts yet.
/// Uniswap v4 launch code exists unmodified at upstream/openlaunch/contracts.
contract V2Adapter is IDexAdapter {
    function version() external pure returns (string memory) {
        return "v2";
    }

    function implemented() external pure returns (bool) {
        return false;
    }

    function available() external pure returns (bool) {
        return false;
    }
}
