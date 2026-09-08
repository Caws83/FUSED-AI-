// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {LaunchFactory} from "src/LaunchFactory.sol";

/// @notice Deploys Fused AI LaunchFactory (which constructs LaunchLocker).
/// Reads local Uniswap addresses from env. Never uses OpenLaunch production addresses.
contract DeployFusedLocal is Script {
    function run() public returns (LaunchFactory factory) {
        IPoolManager manager = IPoolManager(vm.envAddress("UNISWAP_POOL_MANAGER_ADDRESS"));
        IPositionManager posm = IPositionManager(vm.envAddress("UNISWAP_POSITION_MANAGER_ADDRESS"));
        IAllowanceTransfer permit2 = IAllowanceTransfer(vm.envAddress("UNISWAP_PERMIT2_ADDRESS"));

        address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        vm.startBroadcast(deployer);
        factory = new LaunchFactory(manager, posm, permit2);
        vm.stopBroadcast();

        console2.log("launchFactory", address(factory));
        console2.log("launchLocker", address(factory.locker()));
    }
}
