// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {FusedFactory} from "src/fused/FusedFactory.sol";

/// @notice Robinhood Chain Testnet (46630) only. Explicit curve env. No local envOr defaults.
/// Uniswap v4 must already exist; this script never deploys a fake stack.
contract DeployFusedTestnet is Script {
    uint256 internal constant TESTNET_CHAIN_ID = 46630;
    uint256 internal constant MAINNET_CHAIN_ID = 4663;
    uint256 internal constant LOCAL_GRADUATION_TARGET = 0.1 ether;

    address internal constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant POSITION_MANAGER = 0x58daec3116aae6D93017bAAea7749052E8a04fA7;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    address internal constant ANVIL_POOL = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address internal constant ANVIL_POSM = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;

    function run() public returns (FusedFactory factory) {
        require(block.chainid != MAINNET_CHAIN_ID, "refuse robinhood mainnet 4663");
        require(block.chainid == TESTNET_CHAIN_ID, "not robinhood testnet 46630");

        address pm = vm.envAddress("UNISWAP_POOL_MANAGER_ADDRESS");
        address posm = vm.envAddress("UNISWAP_POSITION_MANAGER_ADDRESS");
        address permit2 = vm.envAddress("UNISWAP_PERMIT2_ADDRESS");
        require(pm == POOL_MANAGER && posm == POSITION_MANAGER && permit2 == PERMIT2, "unexpected v4 addresses");
        require(pm != ANVIL_POOL && posm != ANVIL_POSM, "anvil v4 addresses");
        require(pm.code.length > 0 && posm.code.length > 0 && permit2.code.length > 0, "v4 not deployed here");

        uint256 virtualQuote = vm.envUint("FUSED_VIRTUAL_QUOTE_WEI");
        uint256 virtualToken = vm.envUint("FUSED_VIRTUAL_TOKEN");
        uint256 graduationTarget = vm.envUint("FUSED_GRADUATION_TARGET_WEI");
        uint256 feeBps = vm.envUint("FUSED_FEE_BPS");
        uint256 lpFee = vm.envUint("FUSED_LP_FEE");
        require(graduationTarget != LOCAL_GRADUATION_TARGET, "refuse local 0.1 ETH target");
        require(virtualQuote != 0 && virtualToken != 0 && graduationTarget != 0 && lpFee != 0, "explicit curve required");

        uint16 feeBps16 = uint16(feeBps);
        uint24 lpFee24 = uint24(lpFee);
        require(feeBps16 == feeBps && lpFee24 == lpFee, "curve types overflow");

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        factory = new FusedFactory(
            IPoolManager(pm),
            IPositionManager(posm),
            IAllowanceTransfer(permit2),
            FusedFactory.CurveParams({
                virtualQuote: virtualQuote,
                virtualToken: virtualToken,
                graduationTarget: graduationTarget,
                feeBps: feeBps16,
                feeRecipient: address(0),
                lpFee: lpFee24
            })
        );
        vm.stopBroadcast();

        console2.log("launchFactory", address(factory));
        console2.log("launchLocker", address(factory.locker()));
        console2.log("deployBlock", block.number);
        console2.log("chainId", block.chainid);
    }
}
