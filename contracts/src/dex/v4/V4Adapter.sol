// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IDexAdapter} from "../interfaces/IDexAdapter.sol";

/// @notice V4 implementation lives in unmodified OpenLaunch (LaunchFactory/Locker/Token).
/// This adapter reports unimplemented for Fused AI production until those contracts
/// are adopted, tested, and deployed under Fused AI addresses.
contract V4Adapter is IDexAdapter {
    function version() external pure returns (string memory) {
        return "v4";
    }

    /// OpenLaunch v4 is implemented upstream, but it is not a Fused AI production contract yet.
    function implemented() external pure returns (bool) {
        return false;
    }

    function available() external pure returns (bool) {
        return false;
    }
}
