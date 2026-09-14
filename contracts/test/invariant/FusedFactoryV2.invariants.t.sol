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
import {LaunchToken} from "src/LaunchToken.sol";

contract FusedV2Handler is Test {
    FusedFactoryV2 public factory;
    address public token;
    address public creator;
    address[] public traders;

    constructor(FusedFactoryV2 factory_, address token_, address creator_) {
        factory = factory_;
        token = token_;
        creator = creator_;
        traders.push(makeAddr("h1"));
        traders.push(makeAddr("h2"));
        traders.push(makeAddr("h3"));
        for (uint256 i; i < traders.length; ++i) {
            vm.deal(traders[i], 20 ether);
        }
    }

    function buy(uint256 who, uint256 amount) external {
        if (factory.getMarket(token).state != factory.STATE_CURVE()) return;
        who = bound(who, 0, traders.length - 1);
        amount = bound(amount, 0.0001 ether, 0.02 ether);
        address trader = traders[who];
        if (trader.balance < amount) return;
        vm.prank(trader);
        try factory.buy{value: amount}(token, 0, block.timestamp + 60) {} catch {}
    }

    function sell(uint256 who, uint256 bps) external {
        if (factory.getMarket(token).state != factory.STATE_CURVE()) return;
        who = bound(who, 0, traders.length - 1);
        bps = bound(bps, 1, 10_000);
        address trader = traders[who];
        uint256 bal = LaunchToken(token).balanceOf(trader);
        if (bal == 0) return;
        uint256 amt = (bal * bps) / 10_000;
        if (amt == 0) return;
        vm.startPrank(trader);
        LaunchToken(token).approve(address(factory), amt);
        try factory.sell(token, amt, 0, block.timestamp + 60) {} catch {}
        vm.stopPrank();
    }

    function claimCreator() external {
        try factory.claimFor(creator) {} catch {}
    }

    function claimTreasury() external {
        try factory.claimFor(factory.treasury()) {} catch {}
    }
}

contract FusedFactoryV2Invariant is Test, DeployPermit2 {
    FusedFactoryV2 factory;
    FusedV2Handler handler;
    address token;
    address creator;

    function setUp() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer permit2 = IAllowanceTransfer(deployPermit2());
        PositionManager posm =
            new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        creator = makeAddr("creator");
        vm.deal(creator, 1 ether);
        factory = new FusedFactoryV2(
            manager,
            posm,
            permit2,
            FusedFactoryV2.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 2 ether,
                treasury: 0x6F88E279002051ceB09ead378081Df8Fc124AacD,
                lpFee: 10_000
            })
        );
        vm.prank(creator);
        token = factory.create(
            FusedFactoryV2.CreateParams({
                name: "Inv",
                symbol: "INV",
                metadataURI: "local://i",
                salt: bytes32("inv"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        handler = new FusedV2Handler(factory, token, creator);
        targetContract(address(handler));
    }

    function invariant_curveSupplySplitsCleanly() public view {
        FusedFactoryV2.MarketView memory m = factory.getMarket(token);
        if (m.state == factory.STATE_CURVE()) {
            assertEq(m.circulating + m.realToken, m.totalSupply);
            assertEq(LaunchToken(token).balanceOf(address(factory)), m.realToken);
        }
    }

    function invariant_reservedEqualsClaimable() public view {
        assertEq(
            factory.reservedFees(),
            factory.claimable(creator) + factory.claimable(factory.treasury())
        );
    }

    function invariant_ethCoversCurveAndReserved() public view {
        FusedFactoryV2.MarketView memory m = factory.getMarket(token);
        uint256 needed = factory.reservedFees();
        if (m.state == factory.STATE_CURVE()) needed += m.realQuote;
        assertGe(address(factory).balance, needed);
    }

    function invariant_kDoesNotShrink() public view {
        FusedFactoryV2.MarketView memory m = factory.getMarket(token);
        if (m.state == factory.STATE_CURVE()) {
            assertGe(m.virtualQuote * m.virtualToken, factory.virtualQuoteSeed() * factory.virtualTokenSeed());
        }
    }

    function invariant_treasuryAndCreatorStayFixed() public view {
        assertEq(factory.treasury(), factory.FUSED_TREASURY());
        assertEq(factory.getMarket(token).creator, creator);
    }
}

contract FusedV2MultiHandler is Test {
    FusedFactoryV2 public factory;
    address public tokenA;
    address public tokenB;
    address public creatorA;
    address public creatorB;
    address[] public traders;

    constructor(FusedFactoryV2 factory_, address tokenA_, address tokenB_, address creatorA_, address creatorB_) {
        factory = factory_;
        tokenA = tokenA_;
        tokenB = tokenB_;
        creatorA = creatorA_;
        creatorB = creatorB_;
        traders.push(makeAddr("m1"));
        traders.push(makeAddr("m2"));
        for (uint256 i; i < traders.length; ++i) {
            vm.deal(traders[i], 30 ether);
        }
    }

    function _buy(address token, uint256 who, uint256 amount) internal {
        if (factory.getMarket(token).state != factory.STATE_CURVE()) return;
        who = bound(who, 0, traders.length - 1);
        amount = bound(amount, 0.0001 ether, 0.02 ether);
        address trader = traders[who];
        if (trader.balance < amount) return;
        vm.prank(trader);
        try factory.buy{value: amount}(token, 0, block.timestamp + 60) {} catch {}
    }

    function _sell(address token, uint256 who, uint256 bps) internal {
        if (factory.getMarket(token).state != factory.STATE_CURVE()) return;
        who = bound(who, 0, traders.length - 1);
        bps = bound(bps, 1, 10_000);
        address trader = traders[who];
        uint256 bal = LaunchToken(token).balanceOf(trader);
        if (bal == 0) return;
        uint256 amt = (bal * bps) / 10_000;
        if (amt == 0) return;
        vm.startPrank(trader);
        LaunchToken(token).approve(address(factory), amt);
        try factory.sell(token, amt, 0, block.timestamp + 60) {} catch {}
        vm.stopPrank();
    }

    function buyA(uint256 who, uint256 amount) external {
        _buy(tokenA, who, amount);
    }

    function buyB(uint256 who, uint256 amount) external {
        _buy(tokenB, who, amount);
    }

    function sellA(uint256 who, uint256 bps) external {
        _sell(tokenA, who, bps);
    }

    function sellB(uint256 who, uint256 bps) external {
        _sell(tokenB, who, bps);
    }

    function claimAll() external {
        try factory.claimFor(creatorA) {} catch {}
        try factory.claimFor(creatorB) {} catch {}
        try factory.claimFor(factory.treasury()) {} catch {}
    }
}

contract FusedFactoryV2MultiInvariant is Test, DeployPermit2 {
    FusedFactoryV2 factory;
    FusedV2MultiHandler handler;
    address tokenA;
    address tokenB;
    address creatorA;
    address creatorB;

    function setUp() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer permit2 = IAllowanceTransfer(deployPermit2());
        PositionManager posm =
            new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        creatorA = makeAddr("creatorA");
        creatorB = makeAddr("creatorB");
        factory = new FusedFactoryV2(
            manager,
            posm,
            permit2,
            FusedFactoryV2.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 5 ether,
                treasury: 0x6F88E279002051ceB09ead378081Df8Fc124AacD,
                lpFee: 10_000
            })
        );
        vm.prank(creatorA);
        tokenA = factory.create(
            FusedFactoryV2.CreateParams({
                name: "A",
                symbol: "A",
                metadataURI: "local://a",
                salt: bytes32("a"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        vm.prank(creatorB);
        tokenB = factory.create(
            FusedFactoryV2.CreateParams({
                name: "B",
                symbol: "B",
                metadataURI: "local://b",
                salt: bytes32("b"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        handler = new FusedV2MultiHandler(factory, tokenA, tokenB, creatorA, creatorB);
        targetContract(address(handler));
    }

    function invariant_reservedEqualsAllCreatorsAndTreasury() public view {
        assertEq(
            factory.reservedFees(),
            factory.claimable(creatorA) + factory.claimable(creatorB) + factory.claimable(factory.treasury())
        );
    }

    function invariant_ethCoversBothMarketsAndReserved() public view {
        uint256 needed = factory.reservedFees();
        FusedFactoryV2.MarketView memory a = factory.getMarket(tokenA);
        FusedFactoryV2.MarketView memory b = factory.getMarket(tokenB);
        if (a.state == factory.STATE_CURVE()) needed += a.realQuote;
        if (b.state == factory.STATE_CURVE()) needed += b.realQuote;
        assertGe(address(factory).balance, needed);
        assertEq(a.creator, creatorA);
        assertEq(b.creator, creatorB);
    }
}
