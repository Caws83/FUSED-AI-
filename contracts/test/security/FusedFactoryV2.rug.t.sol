// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PositionManager} from "@uniswap/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";

import {FusedFactoryV2} from "src/fused/FusedFactoryV2.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {LaunchToken} from "src/LaunchToken.sol";

contract FusedFactoryV2RugTest is Test, DeployPermit2 {
    FusedFactoryV2 factory;
    PositionManager posm;
    address attacker = makeAddr("attacker");
    address victim = makeAddr("victim");
    address constant TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;

    function setUp() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer permit2 = IAllowanceTransfer(deployPermit2());
        posm = new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        factory = new FusedFactoryV2(
            manager,
            posm,
            permit2,
            FusedFactoryV2.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 0.1 ether,
                treasury: TREASURY,
                lpFee: 10_000
            })
        );
        vm.deal(attacker, 20 ether);
        vm.deal(victim, 20 ether);
    }

    function _graduated() internal returns (address token, uint256 tokenId) {
        vm.prank(victim);
        token = factory.create(
            FusedFactoryV2.CreateParams({
                name: "RugMe",
                symbol: "RUG",
                metadataURI: "local://rug",
                salt: bytes32("rug"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        vm.prank(victim);
        factory.buy{value: uint256(0.1 ether) * 10_000 / 9_900}(token, 1, block.timestamp + 60);
        tokenId = factory.getMarket(token).tokenId;
    }

    function test_attackerCannotTakeLpNft() public {
        (, uint256 tokenId) = _graduated();
        address locker = address(factory.locker());
        vm.startPrank(attacker);
        vm.expectRevert();
        posm.transferFrom(locker, attacker, tokenId);
        vm.expectRevert();
        posm.approve(attacker, tokenId);
        vm.stopPrank();
        assertEq(posm.ownerOf(tokenId), locker);
    }

    function test_creatorCannotWithdrawLp() public {
        (, uint256 tokenId) = _graduated();
        address locker = address(factory.locker());
        vm.prank(victim);
        vm.expectRevert();
        posm.transferFrom(locker, victim, tokenId);
        assertEq(posm.ownerOf(tokenId), locker);
    }

    function test_collectCannotDecreasePrincipalLiquidity() public {
        (address token, uint256 tokenId) = _graduated();
        vm.prank(attacker);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint128 before = posm.getPositionLiquidity(tokenId);
        factory.locker().collect(tokenId);
        assertGe(posm.getPositionLiquidity(tokenId), before);
        assertEq(posm.ownerOf(tokenId), address(factory.locker()));
    }

    function test_attackerCannotRegisterOrRedirectLocker() public {
        (address token, uint256 tokenId) = _graduated();
        FusedLocker locker = factory.locker();
        vm.startPrank(attacker);
        vm.expectRevert(FusedLocker.NotFactory.selector);
        locker.register(tokenId + 1, token, address(0), attacker, attacker);
        vm.stopPrank();
        vm.prank(address(factory));
        vm.expectRevert(FusedLocker.AlreadyRegistered.selector);
        locker.register(tokenId, token, address(0), attacker, TREASURY);
        assertEq(locker.creatorOf(tokenId), victim);
        assertEq(locker.treasuryOf(tokenId), TREASURY);
        assertEq(factory.creatorOf(token), victim);
        assertEq(factory.treasury(), TREASURY);
    }

    function test_unknownTokenCannotGraduate() public {
        vm.expectRevert(FusedFactoryV2.NotCurve.selector);
        factory.graduate(address(0x1234));
    }

    function test_cannotGraduateEarly() public {
        vm.prank(victim);
        address token = factory.create(
            FusedFactoryV2.CreateParams({
                name: "Early",
                symbol: "EAR",
                metadataURI: "local://e",
                salt: bytes32("early"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        vm.expectRevert(FusedFactoryV2.NotReadyToGraduate.selector);
        factory.graduate(token);
    }

    function test_attackerClaimForCannotStealCreatorOrTreasury() public {
        vm.prank(victim);
        address token = factory.create(
            FusedFactoryV2.CreateParams({
                name: "Steal",
                symbol: "STL",
                metadataURI: "local://s",
                salt: bytes32("steal"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        vm.prank(attacker);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint256 attackerBefore = attacker.balance;
        uint256 victimBefore = victim.balance;
        uint256 treasuryBefore = TREASURY.balance;
        vm.prank(attacker);
        factory.claimFor(attacker);
        vm.prank(attacker);
        factory.claimFor(victim);
        vm.prank(attacker);
        factory.claimFor(TREASURY);
        assertEq(attacker.balance, attackerBefore);
        assertEq(victim.balance, victimBefore + 0.003 ether);
        assertEq(TREASURY.balance, treasuryBefore + 0.007 ether);
    }
}
