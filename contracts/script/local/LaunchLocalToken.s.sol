// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {FusedFactory} from "src/fused/FusedFactory.sol";

/// @notice Broadcasts a real FusedFactory.create on the local chain.
contract LaunchLocalToken is Script {
    function run() public returns (address token) {
        FusedFactory factory = FusedFactory(payable(vm.envAddress("LAUNCH_FACTORY_ADDRESS")));
        address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        string memory name = vm.envOr("LAUNCH_NAME", string("Local Fuse"));
        string memory symbol = vm.envOr("LAUNCH_SYMBOL", string("LFUSE"));
        string memory meta = vm.envOr("LAUNCH_METADATA_URI", string("local://manual"));
        bytes32 salt = keccak256(abi.encode(block.timestamp, msg.sender));

        FusedFactory.CreateParams memory p = FusedFactory.CreateParams({
            name: name,
            symbol: symbol,
            metadataURI: meta,
            salt: salt,
            minTokensOut: 0,
            deadline: block.timestamp + 600
        });

        vm.startBroadcast(deployer);
        token = factory.create(p);
        vm.stopBroadcast();

        console2.log("token", token);
        console2.log("locker", address(factory.locker()));
        console2.log("state", factory.getMarket(token).state);
    }
}
