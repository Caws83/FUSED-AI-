// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IDexAdapter} from "../interfaces/IDexAdapter.sol";

/// @notice V4 launch path is implemented by unmodified OpenLaunch core contracts
/// in `src/core/` (LaunchFactory, LaunchLocker, LaunchToken).
/// `available()` stays false until Fused AI deploys those contracts and sets
/// production addresses — Solidity adapters cannot read env, so this flag is
/// compile-time false. The TypeScript adapter becomes available only when
/// LAUNCH_FACTORY_ADDRESS and LAUNCH_LOCKER_ADDRESS are set.
contract V4Adapter is IDexAdapter {
    function version() external pure returns (string memory) {
        return "v4";
    }

    function implemented() external pure returns (bool) {
        return true;
    }

    function available() external pure returns (bool) {
        return false;
    }
}
