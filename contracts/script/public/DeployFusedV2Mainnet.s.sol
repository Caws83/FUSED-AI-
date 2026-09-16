// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {FusedFactoryV2} from "src/fused/FusedFactoryV2.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";

/// @notice Robinhood Chain Mainnet (4663) FusedFactoryV2 + FusedLocker only.
/// Hardcoded approved Pons-like curve. Audited 30/70 curve and 70/10/20 V4 splits.
/// Refuses testnet 46630, Arc, local 0.1 ETH, and the old 0.05 / 0.01 seeds.
contract DeployFusedV2Mainnet is Script {
    uint256 internal constant MAINNET_CHAIN_ID = 4663;
    uint256 internal constant TESTNET_CHAIN_ID = 46630;
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;
    uint256 internal constant ARC_MAINNET_CHAIN_ID = 5042;

    address internal constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant POSITION_MANAGER = 0x58daec3116aae6D93017bAAea7749052E8a04fA7;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant UNIVERSAL_ROUTER = 0x8876789976dEcBfCbBbe364623C63652db8C0904;
    address internal constant STATE_VIEW = 0xF3334192D15450CdD385c8B70e03f9A6bD9E673b;
    address internal constant QUOTER = 0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94;
    address internal constant ARC_POSITION_MANAGER = 0x6049c9a0e26405C0985f9E3685C87d0aE917f82B;

    address internal constant FUSED_TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;

    uint256 internal constant VIRTUAL_QUOTE = 1.68 ether;
    uint256 internal constant VIRTUAL_TOKEN = 1_000_000_000 ether;
    uint256 internal constant GRADUATION_TARGET = 4.2 ether;
    uint24 internal constant LP_FEE = 10_000;

    function run() public returns (FusedFactoryV2 factory) {
        require(block.chainid != TESTNET_CHAIN_ID, "refuse robinhood testnet 46630");
        require(block.chainid != ARC_TESTNET_CHAIN_ID, "refuse arc testnet");
        require(block.chainid != ARC_MAINNET_CHAIN_ID, "refuse arc mainnet");
        require(block.chainid == MAINNET_CHAIN_ID, "not robinhood mainnet 4663");

        require(POSITION_MANAGER != ARC_POSITION_MANAGER, "arc PositionManager");
        require(POOL_MANAGER.code.length > 0, "PoolManager empty");
        require(POSITION_MANAGER.code.length > 0, "PositionManager empty");
        require(PERMIT2.code.length > 0, "Permit2 empty");
        require(UNIVERSAL_ROUTER.code.length > 0, "UniversalRouter empty");
        require(STATE_VIEW.code.length > 0, "StateView empty");
        require(QUOTER.code.length > 0, "Quoter empty");

        require(VIRTUAL_QUOTE == 1.68 ether, "virtualQuote");
        require(VIRTUAL_TOKEN == 1_000_000_000 ether, "virtualToken");
        require(GRADUATION_TARGET == 4.2 ether, "graduationTarget");
        require(VIRTUAL_QUOTE != 0.05 ether, "refuse 0.05 ETH virtualQuote");
        require(GRADUATION_TARGET != 0.01 ether, "refuse testnet 0.01 ETH");
        require(GRADUATION_TARGET != 0.1 ether, "refuse local 0.1 ETH");
        require(GRADUATION_TARGET != 6 ether && GRADUATION_TARGET != 7 ether && GRADUATION_TARGET != 8 ether, "refuse 6/7/8 ETH");
        require(LP_FEE == 10_000, "lpFee");

        (uint256 curveTotal, uint256 curveCreator, uint256 curveTreasury) = FusedFeeMath.curveFee(1 ether);
        require(curveTotal == 0.01 ether && curveCreator == 0.003 ether && curveTreasury == 0.007 ether, "curve 30/70");
        (uint256 v4Creator, uint256 v4Treasury, uint256 v4Compound) = FusedFeeMath.v4Split(1 ether);
        require(v4Creator == 0.70 ether && v4Treasury == 0.10 ether && v4Compound == 0.20 ether, "v4 70/10/20");

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        require(deployer.balance > 0.005 ether, "deployer ETH too low");

        console2.log("kind", "FusedFactoryV2");
        console2.log("chainId", block.chainid);
        console2.log("deployer", deployer);
        console2.log("deployerBalanceWei", deployer.balance);
        console2.log("poolManager", POOL_MANAGER);
        console2.log("positionManager", POSITION_MANAGER);
        console2.log("permit2", PERMIT2);
        console2.log("treasury", FUSED_TREASURY);
        console2.log("virtualQuote", VIRTUAL_QUOTE);
        console2.log("virtualToken", VIRTUAL_TOKEN);
        console2.log("graduationTarget", GRADUATION_TARGET);
        console2.log("lpFee", uint256(LP_FEE));

        vm.startBroadcast(pk);
        factory = new FusedFactoryV2(
            IPoolManager(POOL_MANAGER),
            IPositionManager(POSITION_MANAGER),
            IAllowanceTransfer(PERMIT2),
            FusedFactoryV2.CurveParams({
                virtualQuote: VIRTUAL_QUOTE,
                virtualToken: VIRTUAL_TOKEN,
                graduationTarget: GRADUATION_TARGET,
                treasury: FUSED_TREASURY,
                lpFee: LP_FEE
            })
        );
        vm.stopBroadcast();

        FusedLocker locker = factory.locker();
        require(address(locker) != address(0), "locker missing");
        require(locker.factory() == address(factory), "locker factory mismatch");
        require(address(locker.poolManager()) == POOL_MANAGER, "locker poolManager");
        require(address(locker.positionManager()) == POSITION_MANAGER, "locker positionManager");
        require(address(locker.permit2()) == PERMIT2, "locker permit2");
        require(factory.treasury() == FUSED_TREASURY, "factory treasury");
        require(factory.treasury() == factory.FUSED_TREASURY(), "treasury constant");
        require(factory.creatorFeeBps() == 30, "creatorFeeBps");
        require(factory.treasuryFeeBps() == 70, "treasuryFeeBps");
        require(factory.MAX_FEE_BPS() == 100, "MAX_FEE_BPS");
        require(uint256(factory.creatorFeeBps()) + factory.treasuryFeeBps() == factory.MAX_FEE_BPS(), "fee split");
        require(factory.feeBps() == 100, "feeBps");
        require(factory.graduatedLpFee() == LP_FEE, "graduatedLpFee");
        require(address(factory.poolManager()) == POOL_MANAGER, "factory poolManager");
        require(address(factory.positionManager()) == POSITION_MANAGER, "factory positionManager");
        require(address(factory.permit2()) == PERMIT2, "factory permit2");
        require(factory.virtualQuoteSeed() == VIRTUAL_QUOTE, "virtualQuoteSeed");
        require(factory.virtualTokenSeed() == VIRTUAL_TOKEN, "virtualTokenSeed");
        require(factory.graduationTarget() == GRADUATION_TARGET, "graduationTarget");
        require(factory.TICK_SPACING() == 200, "tickSpacing");

        (bool factoryOwner,) = address(factory).staticcall(abi.encodeWithSignature("owner()"));
        (bool lockerOwner,) = address(locker).staticcall(abi.encodeWithSignature("owner()"));
        require(!factoryOwner && !lockerOwner, "unexpected owner()");

        console2.log("fusedFactoryV2", address(factory));
        console2.log("launchFactory", address(factory));
        console2.log("fusedLocker", address(locker));
        console2.log("launchLocker", address(locker));
        console2.log("creatorFeeBps", factory.creatorFeeBps());
        console2.log("treasuryFeeBps", factory.treasuryFeeBps());
        console2.log("maxFeeBps", factory.MAX_FEE_BPS());
        console2.log("v4CreatorBps", uint256(7000));
        console2.log("v4TreasuryBps", uint256(1000));
        console2.log("v4CompoundBps", uint256(2000));
        console2.log("universalRouter", UNIVERSAL_ROUTER);
        console2.log("stateView", STATE_VIEW);
        console2.log("quoter", QUOTER);
        console2.log("deployBlock", block.number);
    }
}
