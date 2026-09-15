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

/// @notice Arc Testnet (5042002) factory only. No V4. No Robinhood. No Arc mainnet 5042.
contract DeployFusedArcTestnet is Script {
    uint256 internal constant ARC_TESTNET = 5042002;
    uint256 internal constant ARC_MAINNET = 5042;
    uint256 internal constant ROBINHOOD_TESTNET = 46630;
    uint256 internal constant ROBINHOOD_MAINNET = 4663;
    uint256 internal constant LOCAL_GRADUATION_TARGET = 0.1 ether;

    address internal constant CANONICAL_USDC = 0x3600000000000000000000000000000000000000;
    address internal constant FUSED_TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;

    uint256 internal constant VIRTUAL_QUOTE = 0.05 ether;
    uint256 internal constant VIRTUAL_TOKEN = 1_000_000_000 ether;
    uint256 internal constant GRADUATION_TARGET = 0.01 ether;
    uint24 internal constant LP_FEE = 10_000;

    function run() public returns (FusedFactoryArc factory) {
        require(block.chainid != ARC_MAINNET, "refuse arc mainnet 5042");
        require(block.chainid != ROBINHOOD_TESTNET, "refuse robinhood 46630");
        require(block.chainid != ROBINHOOD_MAINNET, "refuse robinhood 4663");
        require(block.chainid == ARC_TESTNET, "not arc testnet 5042002");

        require(CANONICAL_USDC.code.length > 0, "canonical USDC missing");
        require(IERC20Decimals(CANONICAL_USDC).decimals() == 6, "USDC decimals != 6");

        uint256 virtualQuote = vm.envUint("FUSED_VIRTUAL_QUOTE_WEI");
        uint256 virtualToken = vm.envUint("FUSED_VIRTUAL_TOKEN");
        uint256 graduationTarget = vm.envUint("FUSED_GRADUATION_TARGET_WEI");
        uint256 lpFee = vm.envUint("FUSED_LP_FEE");
        require(graduationTarget != LOCAL_GRADUATION_TARGET, "refuse local 0.1 target");
        require(virtualQuote == VIRTUAL_QUOTE, "virtualQuote");
        require(virtualToken == VIRTUAL_TOKEN, "virtualToken");
        require(graduationTarget == GRADUATION_TARGET, "graduationTarget");
        require(lpFee == LP_FEE, "lpFee");

        (uint256 curveTotal, uint256 curveCreator, uint256 curveTreasury) = FusedFeeMath.curveFee(1 ether);
        require(curveTotal == 0.01 ether && curveCreator == 0.003 ether && curveTreasury == 0.007 ether, "curve 30/70");

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        require(deployer.balance > 0.02 ether, "deployer balance too low");

        vm.startBroadcast(pk);
        factory = new FusedFactoryArc(
            IPoolManager(address(0)),
            IPositionManager(address(0)),
            IAllowanceTransfer(address(0)),
            FusedFactoryArc.CurveParams({
                virtualQuote: virtualQuote,
                virtualToken: virtualToken,
                graduationTarget: graduationTarget,
                treasury: FUSED_TREASURY,
                lpFee: uint24(lpFee)
            }),
            CANONICAL_USDC
        );
        vm.stopBroadcast();

        FusedLocker locker = factory.locker();
        require(address(locker) != address(0), "locker missing");
        require(locker.factory() == address(factory), "locker factory mismatch");
        require(!factory.dexEnabled(), "dex must be disabled on 5042002");
        require(address(factory.poolManager()) == address(0), "poolManager must be zero");
        require(address(factory.positionManager()) == address(0), "positionManager must be zero");
        require(factory.quoteToken() == CANONICAL_USDC, "quoteToken");
        require(factory.treasury() == FUSED_TREASURY, "treasury");
        require(factory.creatorFeeBps() == 30 && factory.treasuryFeeBps() == 70, "fees");
        require(factory.feeBps() == 100, "feeBps");
        require(factory.graduationTarget() == GRADUATION_TARGET, "target");
        require(factory.virtualQuoteSeed() == VIRTUAL_QUOTE, "vq");
        require(factory.virtualTokenSeed() == VIRTUAL_TOKEN, "vt");

        (bool factoryOwner,) = address(factory).staticcall(abi.encodeWithSignature("owner()"));
        (bool lockerOwner,) = address(locker).staticcall(abi.encodeWithSignature("owner()"));
        require(!factoryOwner && !lockerOwner, "unexpected owner()");

        console2.log("kind", "FusedFactoryArc");
        console2.log("deployer", deployer);
        console2.log("fusedFactoryArc", address(factory));
        console2.log("fusedLocker", address(locker));
        console2.log("treasury", factory.treasury());
        console2.log("quoteToken", factory.quoteToken());
        console2.log("dexEnabled", factory.dexEnabled());
        console2.log("creatorFeeBps", factory.creatorFeeBps());
        console2.log("treasuryFeeBps", factory.treasuryFeeBps());
        console2.log("graduationTarget", factory.graduationTarget());
        console2.log("chainId", block.chainid);
        console2.log("deployBlock", block.number);
    }
}
