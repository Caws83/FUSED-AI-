// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {FusedFactoryArc} from "src/fused/FusedFactoryArc.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/// @notice Arc Mainnet (5042) FusedFactoryArc + FusedLocker only.
/// Exact 40k circulating-MC constructor integers. Refuses Robinhood and Arc testnet.
contract DeployFusedArcMainnet is Script {
    uint256 internal constant ARC_MAINNET = 5042;
    uint256 internal constant ARC_TESTNET = 5_042_002;
    uint256 internal constant ROBINHOOD_TESTNET = 46630;
    uint256 internal constant ROBINHOOD_MAINNET = 4663;

    address internal constant CANONICAL_USDC = 0x3600000000000000000000000000000000000000;
    address internal constant FUSED_TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;
    address internal constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant POSITION_MANAGER = 0x6049c9a0e26405C0985f9E3685C87d0aE917f82B;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant ROBINHOOD_POSM = 0x58daec3116aae6D93017bAAea7749052E8a04fA7;
    address internal constant MICRO_FACTORY = 0x98Cab6d3FaE4783A0D0cB13701d0e9772d6833E5;

    uint256 internal constant VIRTUAL_QUOTE = 4_571_428_571_428_571_428_570;
    uint256 internal constant VIRTUAL_TOKEN = 1_000_000_000 ether;
    uint256 internal constant GRADUATION_TARGET = 11_428_571_428_571_428_571_425;
    uint24 internal constant LP_FEE = 10_000;

    function run() public returns (FusedFactoryArc factory) {
        require(block.chainid == ARC_MAINNET, "not arc mainnet 5042");
        require(block.chainid != ARC_TESTNET, "refuse arc testnet");
        require(block.chainid != ROBINHOOD_TESTNET, "refuse robinhood 46630");
        require(block.chainid != ROBINHOOD_MAINNET, "refuse robinhood 4663");

        require(CANONICAL_USDC.code.length > 0, "canonical USDC missing");
        require(IERC20Decimals(CANONICAL_USDC).decimals() == 6, "USDC decimals != 6");
        require(POOL_MANAGER.code.length > 0, "PoolManager empty");
        require(POSITION_MANAGER.code.length > 0, "PositionManager empty");
        require(PERMIT2.code.length > 0, "Permit2 empty");
        require(ROBINHOOD_POSM.code.length == 0, "Robinhood PositionManager must be empty");

        require(VIRTUAL_QUOTE == 4_571_428_571_428_571_428_570, "virtualQuote");
        require(VIRTUAL_TOKEN == 1_000_000_000 ether, "virtualToken");
        require(GRADUATION_TARGET == 11_428_571_428_571_428_571_425, "graduationTarget");
        require(VIRTUAL_QUOTE * 5 == GRADUATION_TARGET * 2, "ratio != 0.4");
        require(VIRTUAL_QUOTE != 0.05 ether, "refuse micro virtualQuote");
        require(GRADUATION_TARGET != 0.01 ether, "refuse micro target");
        require(GRADUATION_TARGET != 0.1 ether, "refuse local 0.1");
        require(VIRTUAL_QUOTE != 14_000 ether && GRADUATION_TARGET != 35_000 ether, "refuse 35k raise");
        require(LP_FEE == 10_000, "lpFee");

        (uint256 curveTotal, uint256 curveCreator, uint256 curveTreasury) = FusedFeeMath.curveFee(1 ether);
        require(curveTotal == 0.01 ether && curveCreator == 0.003 ether && curveTreasury == 0.007 ether, "curve 30/70");
        (uint256 v4Creator, uint256 v4Treasury, uint256 v4Compound) = FusedFeeMath.v4Split(1 ether);
        require(v4Creator == 0.70 ether && v4Treasury == 0.10 ether && v4Compound == 0.20 ether, "v4 70/10/20");

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        require(deployer.balance > 1 ether, "deployer USDC too low");

        vm.startBroadcast(pk);
        factory = new FusedFactoryArc(
            IPoolManager(POOL_MANAGER),
            IPositionManager(POSITION_MANAGER),
            IAllowanceTransfer(PERMIT2),
            FusedFactoryArc.CurveParams({
                virtualQuote: VIRTUAL_QUOTE,
                virtualToken: VIRTUAL_TOKEN,
                graduationTarget: GRADUATION_TARGET,
                treasury: FUSED_TREASURY,
                lpFee: LP_FEE
            }),
            CANONICAL_USDC
        );
        vm.stopBroadcast();

        require(address(factory) != MICRO_FACTORY, "refusing disposable micro factory address");
        FusedLocker locker = factory.locker();
        require(address(locker) != address(0), "locker missing");
        require(locker.factory() == address(factory), "locker factory mismatch");
        require(factory.dexEnabled(), "dex must be enabled on 5042");
        require(address(factory.poolManager()) == POOL_MANAGER, "poolManager");
        require(address(factory.positionManager()) == POSITION_MANAGER, "positionManager");
        require(address(factory.permit2()) == PERMIT2, "permit2");
        require(factory.quoteToken() == CANONICAL_USDC, "quoteToken");
        require(factory.treasury() == FUSED_TREASURY, "treasury");
        require(factory.creatorFeeBps() == 30 && factory.treasuryFeeBps() == 70, "fees");
        require(factory.feeBps() == 100, "feeBps");
        require(factory.graduationTarget() == GRADUATION_TARGET, "target");
        require(factory.virtualQuoteSeed() == VIRTUAL_QUOTE, "vq");
        require(factory.virtualTokenSeed() == VIRTUAL_TOKEN, "vt");
        require(factory.graduatedLpFee() == LP_FEE, "lpFee live");

        (bool factoryOwner,) = address(factory).staticcall(abi.encodeWithSignature("owner()"));
        (bool lockerOwner,) = address(locker).staticcall(abi.encodeWithSignature("owner()"));
        require(!factoryOwner && !lockerOwner, "unexpected owner()");

        console2.log("kind", "FusedFactoryArc");
        console2.log("chainId", block.chainid);
        console2.log("deployer", deployer);
        console2.log("fusedFactoryArc", address(factory));
        console2.log("fusedLocker", address(locker));
        console2.log("treasury", factory.treasury());
        console2.log("quoteToken", factory.quoteToken());
        console2.log("poolManager", address(factory.poolManager()));
        console2.log("positionManager", address(factory.positionManager()));
        console2.log("permit2", address(factory.permit2()));
        console2.log("virtualQuote", factory.virtualQuoteSeed());
        console2.log("virtualToken", factory.virtualTokenSeed());
        console2.log("graduationTarget", factory.graduationTarget());
        console2.log("lpFee", uint256(factory.graduatedLpFee()));
        console2.log("deployBlock", block.number);
    }
}
