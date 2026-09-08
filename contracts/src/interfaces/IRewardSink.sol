// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Future reward routing. Phase 1 documents the surface; no speculative mechanics.
interface IRewardSink {
    enum Destination {
        Creator,
        Holder,
        Referral,
        Buyback,
        Community
    }

    function route(address token, Destination destination, address recipient, uint256 amount) external;
}
