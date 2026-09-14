// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Shared 1% curve and 70/10/20 V4 fee splits. Dust goes to the last share.
library FusedFeeMath {
    uint16 internal constant MAX_FEE_BPS = 100;
    uint16 internal constant CREATOR_FEE_BPS = 30;
    uint16 internal constant TREASURY_FEE_BPS = 70;
    uint256 internal constant BPS = 10_000;
    uint16 internal constant V4_CREATOR_BPS = 7_000;
    uint16 internal constant V4_TREASURY_BPS = 1_000;
    uint16 internal constant V4_COMPOUND_BPS = 2_000;

    function curveFee(uint256 amount) internal pure returns (uint256 total, uint256 creator, uint256 treasury) {
        total = (amount * MAX_FEE_BPS) / BPS;
        creator = (total * CREATOR_FEE_BPS) / MAX_FEE_BPS;
        treasury = total - creator;
    }

    function v4Split(uint256 amount) internal pure returns (uint256 creator, uint256 treasury, uint256 compound) {
        creator = (amount * V4_CREATOR_BPS) / BPS;
        treasury = (amount * V4_TREASURY_BPS) / BPS;
        compound = amount - creator - treasury;
    }
}
