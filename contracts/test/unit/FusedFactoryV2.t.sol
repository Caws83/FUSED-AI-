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
import {FusedFactoryV2} from "src/fused/FusedFactoryV2.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";
import {LaunchToken} from "src/LaunchToken.sol";
import {LaunchLocker} from "src/LaunchLocker.sol";

contract RejectEther {
    fallback() external payable {
        revert("nope");
    }

    receive() external payable {
        revert("nope");
    }
}

contract FusedFactoryV2Test is Test, DeployPermit2 {
    IPoolManager manager;
    IAllowanceTransfer permit2;
    PositionManager posm;
    FusedFactoryV2 factory;
    FusedLocker locker;
    FusedFactory v1;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");
    address constant TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;

    function setUp() public {
        manager = IPoolManager(address(new PoolManager(address(this))));
        permit2 = IAllowanceTransfer(deployPermit2());
        posm = new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        factory = _newFactory(5 ether);
        locker = factory.locker();
        v1 = new FusedFactory(
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
        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
        vm.deal(attacker, 50 ether);
    }

    function _newFactory(uint256 target) internal returns (FusedFactoryV2) {
        return new FusedFactoryV2(
            manager,
            posm,
            permit2,
            FusedFactoryV2.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: target,
                treasury: TREASURY,
                lpFee: 10_000
            })
        );
    }

    function _createOn(FusedFactoryV2 f, address who, bytes32 salt) internal returns (address token) {
        vm.prank(who);
        token = f.create(
            FusedFactoryV2.CreateParams({
                name: "Curve Coin",
                symbol: "CRV",
                metadataURI: "local://curve",
                salt: salt,
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
    }

    function _create(address who, bytes32 salt) internal returns (address token) {
        return _createOn(factory, who, salt);
    }

    function _graduatingQuote() internal pure returns (uint256) {
        return uint256(0.1 ether) * 10_000 / 9_900;
    }

    function test_feeConstantsAreExact() public view {
        assertEq(factory.MAX_FEE_BPS(), 100);
        assertEq(factory.feeBps(), 100);
        assertEq(factory.creatorFeeBps(), 30);
        assertEq(factory.treasuryFeeBps(), 70);
        assertEq(uint256(factory.creatorFeeBps()) + factory.treasuryFeeBps(), factory.MAX_FEE_BPS());
    }

    function test_treasuryIsImmutableConfiguredAddress() public view {
        assertEq(factory.treasury(), TREASURY);
        assertEq(factory.FUSED_TREASURY(), TREASURY);
        assertEq(factory.treasury(), factory.FUSED_TREASURY());
    }

    function test_wrongTreasuryReverts() public {
        vm.expectRevert(FusedFactoryV2.BadTreasury.selector);
        new FusedFactoryV2(
            manager,
            posm,
            permit2,
            FusedFactoryV2.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 0.1 ether,
                treasury: attacker,
                lpFee: 10_000
            })
        );
    }

    function test_curveSplit_exact30_70() public {
        address token = _create(alice, bytes32("curve"));
        vm.prank(alice);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);

        assertEq(factory.claimable(alice), 0.003 ether);
        assertEq(factory.claimable(TREASURY), 0.007 ether);
        assertEq(factory.reservedFees(), 0.01 ether);
        assertEq(factory.getMarket(token).realQuote, 0.99 ether);
        assertEq(address(factory).balance, 1 ether);
        assertEq(alice.balance, 49 ether);
        assertEq(TREASURY.balance, 0);
    }

    function test_creatorIsImmutablePerToken() public {
        address tokenA = _create(alice, bytes32("a"));
        address tokenB = _create(bob, bytes32("b"));
        assertEq(factory.creatorOf(tokenA), alice);
        assertEq(factory.creatorOf(tokenB), bob);
        assertEq(factory.getMarket(tokenA).creator, alice);

        (bool ok,) = address(factory).call(abi.encodeWithSignature("setCreator(address,address)", tokenA, attacker));
        assertFalse(ok);
        vm.prank(bob);
        factory.buy{value: 0.01 ether}(tokenA, 1, block.timestamp + 60);
        assertEq(factory.creatorOf(tokenA), alice);
        assertEq(factory.claimable(alice), (0.01 ether * 30) / 10_000);
        assertEq(factory.claimable(bob), 0);
    }

    function test_noAdminCanRedirectTreasury() public {
        address token = _create(alice, bytes32("redir"));
        vm.prank(alice);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);

        (bool a,) = address(factory).call(abi.encodeWithSignature("setTreasury(address)", attacker));
        (bool b,) = address(factory).call(abi.encodeWithSignature("setFeeRecipient(address)", attacker));
        (bool c,) = address(factory).staticcall(abi.encodeWithSignature("owner()"));
        (bool d,) = address(locker).call(abi.encodeWithSignature("setTreasury(uint256,address)", 1, attacker));
        assertFalse(a);
        assertFalse(b);
        assertFalse(c);
        assertFalse(d);

        uint256 attackerBefore = attacker.balance;
        uint256 treasuryBefore = TREASURY.balance;
        vm.prank(attacker);
        factory.claimFor(TREASURY);
        assertEq(attacker.balance, attackerBefore);
        assertEq(TREASURY.balance, treasuryBefore + 0.007 ether);
        assertEq(factory.claimable(TREASURY), 0);
        assertEq(factory.claimable(attacker), 0);
        assertEq(factory.treasury(), TREASURY);
    }

    function test_claimForPaysOnlyIntendedRecipient() public {
        address token = _create(alice, bytes32("claim"));
        vm.prank(bob);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;
        uint256 attackerBefore = attacker.balance;
        vm.prank(attacker);
        uint256 paid = factory.claimFor(alice);
        assertEq(paid, 0.003 ether);
        assertEq(alice.balance, aliceBefore + 0.003 ether);
        assertEq(bob.balance, bobBefore);
        assertEq(attacker.balance, attackerBefore);
        assertEq(factory.claimable(alice), 0);
        assertEq(factory.claimable(TREASURY), 0.007 ether);
        assertEq(factory.reservedFees(), 0.007 ether);

        vm.prank(attacker);
        assertEq(factory.claimFor(attacker), 0);
        assertEq(attacker.balance, attackerBefore);
    }

    function test_failedCreatorReceiveDoesNotStopTrading() public {
        RejectEther stuck = new RejectEther();
        vm.deal(address(stuck), 5 ether);
        address token = _create(address(stuck), bytes32("stuck-c"));
        vm.prank(bob);
        uint256 out = factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        assertGt(out, 0);
        assertEq(factory.claimable(address(stuck)), 0.003 ether);
        assertEq(factory.claimable(TREASURY), 0.007 ether);
        vm.prank(bob);
        factory.buy{value: 0.01 ether}(token, 1, block.timestamp + 60);
        vm.expectRevert(FusedFactoryV2.EthTransferFailed.selector);
        factory.claimFor(address(stuck));
        assertEq(factory.claimable(address(stuck)), 0.003 ether + (0.01 ether * 30) / 10_000);
    }

    function test_failedTreasuryReceiveDoesNotStopTrading() public {
        vm.etch(TREASURY, type(RejectEther).runtimeCode);
        address token = _create(alice, bytes32("stuck-t"));
        vm.prank(bob);
        uint256 out = factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        assertGt(out, 0);
        assertEq(factory.claimable(TREASURY), 0.007 ether);
        vm.prank(alice);
        factory.buy{value: 0.02 ether}(token, 1, block.timestamp + 60);
        vm.expectRevert(FusedFactoryV2.EthTransferFailed.selector);
        factory.claimFor(TREASURY);
        assertEq(factory.claimable(TREASURY), 0.007 ether + (0.02 ether * 70) / 10_000);
    }

    function test_reservedFeeAccountingAndGraduationExcludesReserved() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        address token = _createOn(f, alice, bytes32("grad"));
        vm.prank(alice);
        f.buy{value: 0.05 ether}(token, 1, block.timestamp + 60);

        (uint256 fee1, uint256 c1, uint256 t1) = FusedFeeMath.curveFee(0.05 ether);
        FusedFactoryV2.MarketView memory onCurve = f.getMarket(token);
        assertEq(onCurve.state, f.STATE_CURVE());
        assertEq(f.reservedFees(), fee1);
        assertEq(f.claimable(alice), c1);
        assertEq(f.claimable(TREASURY), t1);
        assertEq(f.claimable(alice) + f.claimable(TREASURY), f.reservedFees());
        assertEq(onCurve.realQuote, 0.05 ether - fee1);
        assertEq(address(f).balance, 0.05 ether);
        assertGe(address(f).balance, onCurve.realQuote + f.reservedFees());

        uint256 reservedBefore = f.reservedFees();
        vm.prank(alice);
        f.buy{value: 0.06 ether}(token, 1, block.timestamp + 60);

        (uint256 fee2, uint256 c2, uint256 t2) = FusedFeeMath.curveFee(0.06 ether);
        FusedFactoryV2.MarketView memory graduated = f.getMarket(token);
        assertEq(graduated.state, f.STATE_GRADUATED());
        assertEq(graduated.realQuote, 0);
        assertEq(f.reservedFees(), reservedBefore + fee2);
        assertEq(f.claimable(alice), c1 + c2);
        assertEq(f.claimable(TREASURY), t1 + t2);
        assertEq(f.claimable(alice) + f.claimable(TREASURY), f.reservedFees());
        assertGe(address(f).balance, f.reservedFees());
        assertLe(address(f).balance, f.reservedFees() + 1);
        assertGt(graduated.tokenId, 0);
        assertEq(posm.ownerOf(graduated.tokenId), address(l));
        assertGt(posm.getPositionLiquidity(graduated.tokenId), 0);
        assertEq(l.creatorOf(graduated.tokenId), alice);
        assertEq(l.treasuryOf(graduated.tokenId), TREASURY);
    }

    function test_v4Split_exact70_10_20_ofCollected() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        address token = _createOn(f, alice, bytes32("v4"));
        vm.prank(alice);
        f.buy{value: _graduatingQuote()}(token, 1, block.timestamp + 60);
        uint256 tokenId = f.getMarket(token).tokenId;

        vm.prank(bob);
        uint256 bought = f.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        vm.startPrank(bob);
        LaunchToken(token).approve(address(f), bought / 2);
        f.sell(token, bought / 2, 1, block.timestamp + 60);
        vm.stopPrank();

        uint256 aliceEthBefore = alice.balance;
        uint256 treasuryBefore = TREASURY.balance;
        uint256 aliceTokBefore = LaunchToken(token).balanceOf(alice);
        uint256 treasuryTokBefore = LaunchToken(token).balanceOf(TREASURY);
        uint128 liqBefore = posm.getPositionLiquidity(tokenId);

        (uint256 quoteOut, uint256 tokenOut) = l.collect(tokenId);
        assertGt(quoteOut, 0);

        (uint256 cQ, uint256 tQ, uint256 kQ) = FusedFeeMath.v4Split(quoteOut);
        (uint256 cT, uint256 tT, uint256 kT) = FusedFeeMath.v4Split(tokenOut);
        assertEq(cQ + tQ + kQ, quoteOut);
        assertEq(cT + tT + kT, tokenOut);
        assertEq(cQ, (quoteOut * 7_000) / 10_000);
        assertEq(tQ, (quoteOut * 1_000) / 10_000);
        assertEq(kQ, quoteOut - cQ - tQ);

        assertEq(alice.balance - aliceEthBefore, cQ);
        assertEq(TREASURY.balance - treasuryBefore, tQ);
        assertEq(LaunchToken(token).balanceOf(alice) - aliceTokBefore, cT);
        assertEq(LaunchToken(token).balanceOf(TREASURY) - treasuryTokBefore, tT);
        uint128 liqAfter = posm.getPositionLiquidity(tokenId);
        assertGe(liqAfter, liqBefore);
        assertEq(posm.ownerOf(tokenId), address(l));
        assertEq(l.claimable(alice, address(0)), 0);
        assertEq(l.claimable(TREASURY, address(0)), 0);
        assertEq(l.claimable(attacker, address(0)), 0);
        bool compounded = liqAfter > liqBefore;
        bool carried = l.compoundCarry(tokenId, address(0)) > 0 || l.compoundCarry(tokenId, token) > 0;
        assertTrue(compounded || carried || (kQ == 0 && kT == 0), "compound share is LP or carry");
    }

    function test_lockerClaimForPaysOnlyIntendedRecipient() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        RejectEther stuck = new RejectEther();
        vm.deal(address(stuck), 5 ether);
        address token = _createOn(f, address(stuck), bytes32("lock-claim"));
        vm.prank(bob);
        f.buy{value: _graduatingQuote()}(token, 1, block.timestamp + 60);
        uint256 tokenId = f.getMarket(token).tokenId;
        vm.prank(alice);
        f.buy{value: 1 ether}(token, 1, block.timestamp + 60);

        (uint256 quoteOut,) = l.collect(tokenId);
        (uint256 cQ,,) = FusedFeeMath.v4Split(quoteOut);
        assertEq(l.claimable(address(stuck), address(0)), cQ);

        uint256 attackerBefore = attacker.balance;
        vm.prank(attacker);
        vm.expectRevert(FusedLocker.EthTransferFailed.selector);
        l.claimFor(address(stuck), address(0));
        assertEq(l.claimable(address(stuck), address(0)), cQ);
        assertEq(attacker.balance, attackerBefore);
        assertEq(l.claimable(attacker, address(0)), 0);
    }

    function test_v1TokensStillWorkAndDoNotRouteOnV2() public {
        vm.prank(alice);
        address v1Token = v1.create(
            FusedFactory.CreateParams({
                name: "V1",
                symbol: "V1",
                metadataURI: "local://v1",
                salt: bytes32("v1"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        vm.prank(alice);
        uint256 out = v1.buy{value: 0.01 ether}(v1Token, 1, block.timestamp + 60);
        assertGt(out, 0);
        assertEq(v1.getMarket(v1Token).realQuote, 0.01 ether);
        assertEq(LaunchLocker(payable(address(v1.locker()))).factory(), address(v1));

        vm.prank(alice);
        vm.expectRevert(FusedFactoryV2.UnknownMarket.selector);
        factory.buy{value: 0.01 ether}(v1Token, 1, block.timestamp + 60);
    }

    function test_v2TokensRouteOnV2NotV1() public {
        address token = _create(alice, bytes32("v2"));
        vm.prank(alice);
        uint256 out = factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        assertGt(out, 0);
        assertEq(factory.getMarket(token).realQuote, 0.99 ether);

        vm.prank(alice);
        vm.expectRevert(FusedFactory.UnknownMarket.selector);
        v1.buy{value: 0.01 ether}(token, 1, block.timestamp + 60);
    }

    function test_sellAccruesSame30_70Split() public {
        address token = _create(alice, bytes32("sell"));
        vm.startPrank(alice);
        uint256 bought = factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        (uint256 buyFee, uint256 buyC, uint256 buyT) = FusedFeeMath.curveFee(1 ether);
        uint256 realAfterBuy = factory.getMarket(token).realQuote;
        LaunchToken(token).approve(address(factory), bought / 2);
        (uint256 quoted,) = factory.quoteSell(token, bought / 2);
        uint256 sold = factory.sell(token, bought / 2, 1, block.timestamp + 60);
        vm.stopPrank();
        assertEq(sold, quoted);
        uint256 grossOut = realAfterBuy - factory.getMarket(token).realQuote;
        (uint256 sellFee, uint256 sellC, uint256 sellT) = FusedFeeMath.curveFee(grossOut);
        assertEq(sold, grossOut - sellFee);
        assertEq(factory.reservedFees(), buyFee + sellFee);
        assertEq(factory.claimable(alice), buyC + sellC);
        assertEq(factory.claimable(TREASURY), buyT + sellT);
        assertEq(factory.claimable(alice) + factory.claimable(TREASURY), factory.reservedFees());
    }

    function testFuzz_buyAccrues30_70(uint96 amount) public {
        amount = uint96(bound(amount, 0.0001 ether, 0.05 ether));
        address token = _create(alice, bytes32(uint256(amount)));
        vm.prank(bob);
        factory.buy{value: amount}(token, 0, block.timestamp + 60);
        (uint256 total, uint256 creator, uint256 treasuryShare) = FusedFeeMath.curveFee(amount);
        assertEq(factory.claimable(alice), creator);
        assertEq(factory.claimable(TREASURY), treasuryShare);
        assertEq(factory.reservedFees(), total);
        assertEq(factory.getMarket(token).realQuote, uint256(amount) - total);
        assertEq(address(factory).balance, uint256(amount));
        assertGe(address(factory).balance, factory.getMarket(token).realQuote + factory.reservedFees());
    }

    function test_postGraduationSwapStillWorks() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        address token = _createOn(f, alice, bytes32("post"));
        vm.prank(alice);
        f.buy{value: _graduatingQuote()}(token, 1, block.timestamp + 60);
        vm.prank(bob);
        uint256 out = f.buy{value: 0.01 ether}(token, 1, block.timestamp + 60);
        assertGt(out, 0);
        vm.startPrank(bob);
        LaunchToken(token).approve(address(f), out / 2);
        uint256 sold = f.sell(token, out / 2, 1, block.timestamp + 60);
        vm.stopPrank();
        assertGt(sold, 0);
    }
}
