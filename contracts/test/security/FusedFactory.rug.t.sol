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
import {FusedFactory} from "src/fused/FusedFactory.sol";
import {LaunchToken} from "src/LaunchToken.sol";

contract FusedFactoryRugTest is Test, DeployPermit2 {
    FusedFactory factory;
    PositionManager posm;
    address attacker = makeAddr("attacker");
    address victim = makeAddr("victim");

    function setUp() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer permit2 = IAllowanceTransfer(deployPermit2());
        posm = new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        factory = new FusedFactory(
            manager,
            posm,
            permit2,
            FusedFactory.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 0.1 ether,
                feeBps: 0,
                feeRecipient: address(0),
                lpFee: 10_000
            })
        );
        vm.deal(attacker, 20 ether);
        vm.deal(victim, 20 ether);
    }

    function _graduated() internal returns (address token, uint256 tokenId) {
        vm.prank(victim);
        token = factory.create(
            FusedFactory.CreateParams({
                name: "RugMe",
                symbol: "RUG",
                metadataURI: "local://rug",
                salt: bytes32("rug"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        vm.prank(victim);
        factory.buy{value: 0.1 ether}(token, 1, block.timestamp + 60);
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

    function test_unknownTokenCannotGraduate() public {
        vm.expectRevert(FusedFactory.NotCurve.selector);
        factory.graduate(address(0x1234));
    }

    function test_cannotGraduateEarly() public {
        vm.prank(victim);
        address token = factory.create(
            FusedFactory.CreateParams({
                name: "Early",
                symbol: "EAR",
                metadataURI: "local://e",
                salt: bytes32("early"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        vm.expectRevert(FusedFactory.NotReadyToGraduate.selector);
        factory.graduate(token);
    }
}

contract FusedFactoryFeeTest is Test, DeployPermit2 {
    FusedFactory factory;
    address treasury = makeAddr("treasury");
    address trader = makeAddr("trader");

    function setUp() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer permit2 = IAllowanceTransfer(deployPermit2());
        PositionManager posm =
            new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        factory = new FusedFactory(
            manager,
            posm,
            permit2,
            FusedFactory.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 5 ether,
                feeBps: 100,
                feeRecipient: treasury,
                lpFee: 10_000
            })
        );
        vm.deal(trader, 10 ether);
    }

    function test_feeIsVisibleAndPaid() public {
        vm.prank(trader);
        address token = factory.create(
            FusedFactory.CreateParams({
                name: "Fee",
                symbol: "FEE",
                metadataURI: "local://f",
                salt: bytes32("fee"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        uint256 before = treasury.balance;
        vm.prank(trader);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        assertEq(treasury.balance - before, 0.01 ether);
        assertEq(factory.getMarket(token).realQuote, 0.99 ether);
    }
}
