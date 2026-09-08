// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IDexAdapter} from "../interfaces/IDexAdapter.sol";

contract V3Adapter is IDexAdapter {
    function version() external pure returns (string memory) {
        return "v3";
    }

    function implemented() external pure returns (bool) {
        return false;
    }

    function available() external pure returns (bool) {
        return false;
    }
}
