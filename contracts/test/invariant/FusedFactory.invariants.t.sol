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

contract FusedHandler is Test {
    FusedFactory public factory;
    address public token;
    address[] public traders;

    constructor(FusedFactory factory_, address token_) {
        factory = factory_;
        token = token_;
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
}

contract FusedFactoryInvariant is Test, DeployPermit2 {
    FusedFactory factory;
    FusedHandler handler;
    address token;

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
                graduationTarget: 2 ether,
                feeBps: 0,
                feeRecipient: address(0),
                lpFee: 10_000
            })
        );
        token = factory.create(
            FusedFactory.CreateParams({
                name: "Inv",
                symbol: "INV",
                metadataURI: "local://i",
                salt: bytes32("inv"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        handler = new FusedHandler(factory, token);
        targetContract(address(handler));
    }

    function invariant_curveSupplySplitsCleanly() public view {
        FusedFactory.MarketView memory m = factory.getMarket(token);
        if (m.state == factory.STATE_CURVE()) {
            assertEq(m.circulating + m.realToken, m.totalSupply);
            assertEq(LaunchToken(token).balanceOf(address(factory)), m.realToken);
            assertLe(m.realQuote, address(factory).balance);
        }
    }

    function invariant_kDoesNotShrink() public view {
        FusedFactory.MarketView memory m = factory.getMarket(token);
        if (m.state == factory.STATE_CURVE()) {
            assertGe(m.virtualQuote * m.virtualToken, factory.virtualQuoteSeed() * factory.virtualTokenSeed());
        }
    }
}
