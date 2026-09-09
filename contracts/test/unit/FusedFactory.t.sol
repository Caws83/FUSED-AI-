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
import {LaunchLocker} from "src/LaunchLocker.sol";

contract ReentrantBuyer {
    FusedFactory factory;
    address token;

    constructor(FusedFactory f) {
        factory = f;
    }

    function setToken(address t) external {
        token = t;
    }

    receive() external payable {
        if (token != address(0) && address(factory).balance > 0.001 ether) {
            factory.buy{value: 0.001 ether}(token, 0, block.timestamp + 60);
        }
    }
}

contract FusedFactoryTest is Test, DeployPermit2 {
    IPoolManager manager;
    IAllowanceTransfer permit2;
    PositionManager posm;
    FusedFactory factory;
    LaunchLocker locker;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        manager = IPoolManager(address(new PoolManager(address(this))));
        permit2 = IAllowanceTransfer(deployPermit2());
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
        locker = factory.locker();
        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
    }

    function _create() internal returns (address token) {
        vm.prank(alice);
        token = factory.create(
            FusedFactory.CreateParams({
                name: "Curve Coin",
                symbol: "CRV",
                metadataURI: "local://curve",
                salt: bytes32("curve"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
    }

    function test_createStartsOnCurveWithFullInventory() public {
        address token = _create();
        FusedFactory.MarketView memory m = factory.getMarket(token);
        assertEq(m.state, factory.STATE_CURVE());
        assertEq(m.realToken, 1_000_000_000 ether);
        assertEq(m.realQuote, 0);
        assertEq(m.circulating, 0);
        assertEq(m.creator, alice);
        assertEq(LaunchToken(token).balanceOf(address(factory)), m.realToken);
        assertEq(factory.launchCount(), 1);
    }

    function test_firstBuyMovesInventory() public {
        address token = _create();
        vm.prank(alice);
        uint256 out = factory.buy{value: 0.01 ether}(token, 1, block.timestamp + 60);
        assertGt(out, 0);
        assertEq(LaunchToken(token).balanceOf(alice), out);
        FusedFactory.MarketView memory m = factory.getMarket(token);
        assertEq(m.realQuote, 0.01 ether);
        assertEq(m.circulating, out);
        assertEq(m.progressBps, 1_000);
    }

    function test_sellReturnsQuoteAndRestoresInventory() public {
        address token = _create();
        vm.startPrank(alice);
        uint256 bought = factory.buy{value: 0.02 ether}(token, 1, block.timestamp + 60);
        LaunchToken(token).approve(address(factory), bought);
        uint256 ethBefore = alice.balance;
        uint256 sold = factory.sell(token, bought, 1, block.timestamp + 60);
        vm.stopPrank();
        assertGt(sold, 0);
        assertLe(sold, 0.02 ether);
        assertEq(alice.balance, ethBefore + sold);
        assertEq(LaunchToken(token).balanceOf(alice), 0);
        FusedFactory.MarketView memory m = factory.getMarket(token);
        assertEq(m.circulating, 0);
        assertEq(m.realToken, 1_000_000_000 ether);
    }

    function test_slippageBuyReverts() public {
        address token = _create();
        vm.prank(alice);
        vm.expectRevert(FusedFactory.Slippage.selector);
        factory.buy{value: 0.01 ether}(token, type(uint256).max, block.timestamp + 60);
    }

    function test_zeroBuyReverts() public {
        address token = _create();
        vm.prank(alice);
        vm.expectRevert(FusedFactory.ZeroValue.selector);
        factory.buy{value: 0}(token, 0, block.timestamp + 60);
    }

    function test_deadlineReverts() public {
        address token = _create();
        vm.prank(alice);
        vm.expectRevert(FusedFactory.DeadlineExpired.selector);
        factory.buy{value: 0.01 ether}(token, 0, block.timestamp - 1);
    }

    function test_secondBuyerPaysHigherPrice() public {
        address token = _create();
        vm.prank(alice);
        uint256 aOut = factory.buy{value: 0.02 ether}(token, 1, block.timestamp + 60);
        vm.prank(bob);
        uint256 bOut = factory.buy{value: 0.02 ether}(token, 1, block.timestamp + 60);
        assertLt(bOut, aOut);
    }

    function test_creatorBuyUsesSameMath() public {
        vm.prank(alice);
        address token = factory.create{value: 0.01 ether}(
            FusedFactory.CreateParams({
                name: "Creator",
                symbol: "CRE",
                metadataURI: "local://c",
                salt: bytes32("creator"),
                minTokensOut: 1,
                deadline: block.timestamp + 60
            })
        );
        assertGt(LaunchToken(token).balanceOf(alice), 0);
        FusedFactory.MarketView memory m = factory.getMarket(token);
        assertEq(m.realQuote, 0.01 ether);
    }

    function test_graduationLocksLpAndStopsCurve() public {
        address token = _create();
        vm.prank(alice);
        factory.buy{value: 0.1 ether}(token, 1, block.timestamp + 60);
        FusedFactory.MarketView memory m = factory.getMarket(token);
        assertEq(m.state, factory.STATE_GRADUATED());
        assertGt(m.tokenId, 0);
        assertEq(posm.ownerOf(m.tokenId), address(locker));
        assertGt(posm.getPositionLiquidity(m.tokenId), 0);
        vm.prank(alice);
        vm.expectRevert();
        posm.transferFrom(address(locker), alice, m.tokenId);
    }

    function test_graduateTwiceReverts() public {
        address token = _create();
        vm.prank(alice);
        factory.buy{value: 0.1 ether}(token, 1, block.timestamp + 60);
        vm.expectRevert(FusedFactory.NotCurve.selector);
        factory.graduate(token);
    }

    function test_postGraduationSwap() public {
        address token = _create();
        vm.prank(alice);
        factory.buy{value: 0.1 ether}(token, 1, block.timestamp + 60);
        uint256 bobBefore = LaunchToken(token).balanceOf(bob);
        vm.prank(bob);
        uint256 out = factory.buy{value: 0.01 ether}(token, 1, block.timestamp + 60);
        assertGt(out, 0);
        assertEq(LaunchToken(token).balanceOf(bob), bobBefore + out);

        vm.startPrank(bob);
        LaunchToken(token).approve(address(factory), out / 2);
        uint256 ethBefore = bob.balance;
        uint256 sold = factory.sell(token, out / 2, 1, block.timestamp + 60);
        vm.stopPrank();
        assertGt(sold, 0);
        assertEq(bob.balance, ethBefore + sold);
    }

    function test_factoryAndLockerHaveNoOwner() public {
        _create();
        (bool a,) = address(factory).staticcall(abi.encodeWithSignature("owner()"));
        (bool b,) = address(locker).staticcall(abi.encodeWithSignature("owner()"));
        assertFalse(a);
        assertFalse(b);
    }

    function test_partialAndTinyBuys() public {
        address token = _create();
        vm.startPrank(alice);
        factory.buy{value: 0.0001 ether}(token, 0, block.timestamp + 60);
        factory.buy{value: 0.001 ether}(token, 1, block.timestamp + 60);
        uint256 mid = factory.buy{value: 0.03 ether}(token, 1, block.timestamp + 60);
        LaunchToken(token).approve(address(factory), mid / 4);
        factory.sell(token, mid / 4, 0, block.timestamp + 60);
        vm.stopPrank();
    }

    function testFuzz_multipleBuysConserveSupply(uint8 n) public {
        n = uint8(bound(n, 1, 8));
        address token = _create();
        uint256 circulating;
        for (uint256 i; i < n; ++i) {
            address who = makeAddr(string(abi.encodePacked("t", i)));
            vm.deal(who, 1 ether);
            vm.prank(who);
            uint256 out = factory.buy{value: 0.005 ether}(token, 0, block.timestamp + 60);
            circulating += out;
        }
        FusedFactory.MarketView memory m = factory.getMarket(token);
        assertEq(m.circulating + m.realToken, m.totalSupply);
        assertEq(m.circulating, circulating);
    }
}
