// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PositionManager} from "@uniswap/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";

/// @notice Local Uniswap v4 stack required by LaunchFactory.launch.
/// Deploys official PoolManager + PositionManager. Permit2 is the canonical
/// CREATE2 bytecode etched at the well-known address (Uniswap DeployPermit2).
/// StateView / Quoter / UniversalRouter are not required for launch().
contract DeployLocalUniswap is Script, DeployPermit2 {
    function deployUniswap()
        public
        returns (IPoolManager manager, IAllowanceTransfer permit2, PositionManager posm)
    {
        permit2 = IAllowanceTransfer(deployPermit2());

        address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        vm.startBroadcast(deployer);
        manager = IPoolManager(address(new PoolManager(msg.sender)));
        posm = new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        vm.stopBroadcast();

        console2.log("poolManager", address(manager));
        console2.log("permit2", address(permit2));
        console2.log("positionManager", address(posm));
    }
}
