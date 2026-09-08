// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PositionManager} from "@uniswap/v4-periphery/src/PositionManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPositionDescriptor} from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";
import {LaunchFactory} from "src/LaunchFactory.sol";

/// @notice One-shot local Anvil deploy: Uniswap v4 (required) + Fused factory/locker.
/// `vm.etch` for Permit2 does not persist on Anvil; `scripts/deploy-local.mjs`
/// follows this script with `anvil_setCode` using the same official bytecode.
contract DeployLocalStack is Script, DeployPermit2 {
    function deployAll() public returns (LaunchFactory factory) {
        IAllowanceTransfer permit2 = IAllowanceTransfer(deployPermit2());

        address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        vm.startBroadcast(deployer);
        IPoolManager manager = IPoolManager(address(new PoolManager(msg.sender)));
        PositionManager posm =
            new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        factory = new LaunchFactory(manager, IPositionManager(address(posm)), permit2);
        vm.stopBroadcast();

        console2.log("poolManager", address(manager));
        console2.log("permit2", address(permit2));
        console2.log("positionManager", address(posm));
        console2.log("launchFactory", address(factory));
        console2.log("launchLocker", address(factory.locker()));
        console2.log("deployBlock", block.number);
    }
}
