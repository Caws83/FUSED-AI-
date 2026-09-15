// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {FusedFactoryV2} from "src/fused/FusedFactoryV2.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";

/// @notice Robinhood Chain Testnet (46630) V2 factory/locker only.
/// Does not deploy or replace v1. Does not write the v1 deployment manifest.
/// Curve seeds match live testnet v1; fees are the audited V2 30/70 + 1% LP split.
///
/// Dry-run (no broadcast). Pin a recent block; this RPC can reject unpinned account queries:
///   forge script script/public/DeployFusedV2Testnet.s.sol:DeployFusedV2Testnet \
///     --fork-url https://rpc.testnet.chain.robinhood.com --fork-block-number <latest-1> -vvv
/// Do not add --broadcast until a later explicit deploy step.
contract DeployFusedV2Testnet is Script {
    uint256 internal constant TESTNET_CHAIN_ID = 46630;
    uint256 internal constant MAINNET_CHAIN_ID = 4663;
    uint256 internal constant LOCAL_GRADUATION_TARGET = 0.1 ether;

    address internal constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant POSITION_MANAGER = 0x58daec3116aae6D93017bAAea7749052E8a04fA7;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant UNIVERSAL_ROUTER = 0x8876789976dEcBfCbBbe364623C63652db8C0904;
    address internal constant STATE_VIEW = 0xF3334192D15450CdD385c8B70e03f9A6bD9E673b;
    address internal constant QUOTER = 0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94;

    address internal constant ANVIL_POOL = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address internal constant ANVIL_POSM = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;

    address internal constant FUSED_TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;

    /// Same seeds as deployments/robinhood-testnet-46630.json (v1). Not local 0.1 ETH.
    uint256 internal constant VIRTUAL_QUOTE = 0.05 ether;
    uint256 internal constant VIRTUAL_TOKEN = 1_000_000_000 ether;
    uint256 internal constant GRADUATION_TARGET = 0.01 ether;
    uint24 internal constant LP_FEE = 10_000;

    function run() public returns (FusedFactoryV2 factory) {
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
        uint256 lpFee = vm.envUint("FUSED_LP_FEE");
        require(graduationTarget != LOCAL_GRADUATION_TARGET, "refuse local 0.1 ETH target");
        require(virtualQuote == VIRTUAL_QUOTE, "virtualQuote must match testnet v1 seed");
        require(virtualToken == VIRTUAL_TOKEN, "virtualToken must match testnet v1 seed");
        require(graduationTarget == GRADUATION_TARGET, "graduationTarget must match testnet 0.01 ETH");
        require(lpFee == LP_FEE, "lpFee must be 10000 pips");

        address treasury = FUSED_TREASURY;

        (uint256 curveTotal, uint256 curveCreator, uint256 curveTreasury) = FusedFeeMath.curveFee(1 ether);
        require(curveTotal == 0.01 ether && curveCreator == 0.003 ether && curveTreasury == 0.007 ether, "curve 30/70");
        (uint256 v4Creator, uint256 v4Treasury, uint256 v4Compound) = FusedFeeMath.v4Split(1 ether);
        require(v4Creator == 0.70 ether && v4Treasury == 0.10 ether && v4Compound == 0.20 ether, "v4 70/10/20");

        require(UNIVERSAL_ROUTER.code.length > 0 && STATE_VIEW.code.length > 0 && QUOTER.code.length > 0, "v4 periphery missing");

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        // Simulation cheatcode only. Never broadcast. Lets dry-run succeed with an empty key.
        if (deployer.balance < 0.05 ether) {
            vm.deal(deployer, 1 ether);
        }

        vm.startBroadcast(pk);
        factory = new FusedFactoryV2(
            IPoolManager(pm),
            IPositionManager(posm),
            IAllowanceTransfer(permit2),
            FusedFactoryV2.CurveParams({
                virtualQuote: virtualQuote,
                virtualToken: virtualToken,
                graduationTarget: graduationTarget,
                treasury: treasury,
                lpFee: uint24(lpFee)
            })
        );
        vm.stopBroadcast();

        FusedLocker locker = factory.locker();
        require(address(locker) != address(0), "locker missing");
        require(locker.factory() == address(factory), "locker factory mismatch");
        require(address(locker.poolManager()) == pm, "locker poolManager mismatch");
        require(address(locker.positionManager()) == posm, "locker positionManager mismatch");
        require(address(locker.permit2()) == permit2, "locker permit2 mismatch");
        require(factory.treasury() == FUSED_TREASURY, "factory treasury mismatch");
        require(factory.treasury() == factory.FUSED_TREASURY(), "treasury constant mismatch");
        require(factory.creatorFeeBps() == 30, "creatorFeeBps");
        require(factory.treasuryFeeBps() == 70, "treasuryFeeBps");
        require(factory.MAX_FEE_BPS() == 100, "MAX_FEE_BPS");
        require(uint256(factory.creatorFeeBps()) + factory.treasuryFeeBps() == factory.MAX_FEE_BPS(), "fee split");
        require(factory.feeBps() == 100, "feeBps");
        require(factory.graduatedLpFee() == LP_FEE, "graduatedLpFee");
        require(address(factory.poolManager()) == pm, "factory poolManager");
        require(address(factory.positionManager()) == posm, "factory positionManager");
        require(address(factory.permit2()) == permit2, "factory permit2");
        require(factory.virtualQuoteSeed() == VIRTUAL_QUOTE, "virtualQuoteSeed");
        require(factory.virtualTokenSeed() == VIRTUAL_TOKEN, "virtualTokenSeed");
        require(factory.graduationTarget() == GRADUATION_TARGET, "graduationTarget");
        require(factory.TICK_SPACING() == 200, "tickSpacing");

        (bool factoryOwner,) = address(factory).staticcall(abi.encodeWithSignature("owner()"));
        (bool lockerOwner,) = address(locker).staticcall(abi.encodeWithSignature("owner()"));
        require(!factoryOwner && !lockerOwner, "unexpected owner()");

        console2.log("kind", "FusedFactoryV2");
        console2.log("deployer", deployer);
        console2.log("fusedFactoryV2", address(factory));
        console2.log("fusedLocker", address(locker));
        console2.log("treasury", factory.treasury());
        console2.log("creatorFeeBps", factory.creatorFeeBps());
        console2.log("treasuryFeeBps", factory.treasuryFeeBps());
        console2.log("maxFeeBps", factory.MAX_FEE_BPS());
        console2.log("lpFee", factory.graduatedLpFee());
        console2.log("v4CreatorBps", uint256(7000));
        console2.log("v4TreasuryBps", uint256(1000));
        console2.log("v4CompoundBps", uint256(2000));
        console2.log("hooks", address(0));
        console2.log("poolManager", pm);
        console2.log("positionManager", posm);
        console2.log("permit2", permit2);
        console2.log("universalRouter", UNIVERSAL_ROUTER);
        console2.log("stateView", STATE_VIEW);
        console2.log("quoter", QUOTER);
        console2.log("chainId", block.chainid);
        console2.log("deployBlock", block.number);
    }
}
