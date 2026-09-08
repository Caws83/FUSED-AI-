// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {LaunchFactory} from "src/LaunchFactory.sol";
import {LaunchLocker} from "src/LaunchLocker.sol";

/// @notice Broadcasts a real LaunchFactory.launch on the local chain.
/// Used to prove the pipeline; the UI uses the same ABI via the wallet.
contract LaunchLocalToken is Script {
    function run() public returns (address token, uint256 tokenId) {
        LaunchFactory factory = LaunchFactory(vm.envAddress("LAUNCH_FACTORY_ADDRESS"));
        address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        string memory name = vm.envOr("LAUNCH_NAME", string("Local Fuse"));
        string memory symbol = vm.envOr("LAUNCH_SYMBOL", string("LFUSE"));
        string memory meta = vm.envOr("LAUNCH_METADATA_URI", string("local://manual"));
        bytes32 salt = keccak256(abi.encode(block.timestamp, msg.sender));

        LaunchLocker.Recipient[] memory recipients = new LaunchLocker.Recipient[](0);
        LaunchFactory.LaunchParams memory p = LaunchFactory.LaunchParams({
            name: name,
            symbol: symbol,
            metadataURI: meta,
            quote: address(0),
            supply: 0,
            startTick: 184_200,
            lpFee: 10_000,
            salt: salt,
            recipients: recipients
        });

        vm.startBroadcast(deployer);
        (token, tokenId) = factory.launch(p);
        vm.stopBroadcast();

        console2.log("token", token);
        console2.log("tokenId", tokenId);
        console2.log("locker", address(factory.locker()));
    }
}
