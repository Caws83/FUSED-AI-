// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PositionManager} from "@uniswap/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";

import {FusedFactory} from "src/fused/FusedFactory.sol";
import {FusedFactoryV2} from "src/fused/FusedFactoryV2.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";
import {LaunchToken} from "src/LaunchToken.sol";

contract RejectEther {
    fallback() external payable {
        revert("nope");
    }

    receive() external payable {
        revert("nope");
    }
}

contract ReenterClaim {
    FusedFactoryV2 public factory;
    uint256 public innerAttempts;

    function setFactory(FusedFactoryV2 f) external {
        factory = f;
    }

    receive() external payable {
        innerAttempts++;
        try factory.claim() {} catch {}
    }
}

contract ReenterLockerCollect {
    FusedLocker public locker;
    uint256 public tokenId;
    uint256 public attempts;

    function set(FusedLocker l, uint256 id) external {
        locker = l;
        tokenId = id;
    }

    receive() external payable {
        attempts++;
        try locker.collect(tokenId) {} catch {}
    }
}

contract FusedFactoryV2AuditTest is Test, DeployPermit2 {
    IPoolManager manager;
    IAllowanceTransfer permit2;
    PositionManager posm;
    FusedFactoryV2 factory;
    FusedLocker locker;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address attacker = makeAddr("attacker");
    address constant TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;

    function setUp() public {
        manager = IPoolManager(address(new PoolManager(address(this))));
        permit2 = IAllowanceTransfer(deployPermit2());
        posm = new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        factory = _newFactory(5 ether);
        locker = factory.locker();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
        vm.deal(attacker, 100 ether);
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
                name: "T",
                symbol: "T",
                metadataURI: "local://t",
                salt: salt,
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
    }

    function _gradQuote() internal pure returns (uint256) {
        return uint256(0.1 ether) * 10_000 / 9_900;
    }

    function _graduate(FusedFactoryV2 f, address token, address buyer) internal returns (uint256 tokenId) {
        vm.prank(buyer);
        f.buy{value: _gradQuote()}(token, 1, block.timestamp + 60);
        tokenId = f.getMarket(token).tokenId;
        assertGt(tokenId, 0);
    }

    function test_failedClaimPreservesAccounting() public {
        RejectEther stuck = new RejectEther();
        vm.deal(address(stuck), 5 ether);
        address token = _createOn(factory, address(stuck), bytes32("fail-claim"));
        vm.prank(charlie);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint256 credited = factory.claimable(address(stuck));
        assertEq(credited, 0.003 ether);
        uint256 reserved = factory.reservedFees();
        vm.expectRevert(FusedFactoryV2.EthTransferFailed.selector);
        factory.claimFor(address(stuck));
        assertEq(factory.claimable(address(stuck)), credited);
        assertEq(factory.reservedFees(), reserved);
    }

    function test_repeatedClaimIsZero() public {
        address token = _createOn(factory, alice, bytes32("rep-claim"));
        vm.prank(charlie);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint256 paid = factory.claimFor(alice);
        assertEq(paid, 0.003 ether);
        assertEq(factory.claimFor(alice), 0);
        assertEq(factory.claimable(alice), 0);
    }

    function test_reentrantClaimCannotDoublePay() public {
        ReenterClaim recv = new ReenterClaim();
        recv.setFactory(factory);
        vm.deal(address(recv), 5 ether);
        address token = _createOn(factory, address(recv), bytes32("reenter"));
        vm.prank(charlie);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint256 before = address(recv).balance;
        uint256 paid = factory.claimFor(address(recv));
        assertEq(paid, 0.003 ether);
        assertEq(address(recv).balance, before + 0.003 ether);
        assertEq(factory.claimable(address(recv)), 0);
        assertGt(recv.innerAttempts(), 0);
    }

    function test_multipleCreatorsDoNotShareClaimable() public {
        address tokenA = _createOn(factory, alice, bytes32("ca"));
        address tokenB = _createOn(factory, bob, bytes32("cb"));
        vm.prank(charlie);
        factory.buy{value: 1 ether}(tokenA, 1, block.timestamp + 60);
        vm.prank(charlie);
        factory.buy{value: 2 ether}(tokenB, 1, block.timestamp + 60);
        assertEq(factory.claimable(alice), 0.003 ether);
        assertEq(factory.claimable(bob), 0.006 ether);
        assertEq(factory.claimable(TREASURY), 0.007 ether + 0.014 ether);
        assertEq(factory.reservedFees(), factory.claimable(alice) + factory.claimable(bob) + factory.claimable(TREASURY));
        uint256 bobBefore = bob.balance;
        factory.claimFor(alice);
        assertEq(bob.balance, bobBefore);
        assertEq(factory.claimable(bob), 0.006 ether);
        assertEq(factory.getMarket(tokenA).realQuote + factory.getMarket(tokenB).realQuote + factory.reservedFees(), address(factory).balance);
    }

    function test_graduationLeavesOtherMarketAndReservedIntact() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        address tokenA = _createOn(f, alice, bytes32("ga"));
        address tokenB = _createOn(f, bob, bytes32("gb"));
        vm.prank(charlie);
        f.buy{value: 0.05 ether}(tokenB, 1, block.timestamp + 60);
        uint256 bReal = f.getMarket(tokenB).realQuote;
        uint256 reservedBeforeGrad = f.reservedFees();
        vm.prank(alice);
        f.buy{value: _gradQuote()}(tokenA, 1, block.timestamp + 60);
        assertEq(f.getMarket(tokenA).state, f.STATE_GRADUATED());
        assertEq(f.getMarket(tokenB).state, f.STATE_CURVE());
        assertEq(f.getMarket(tokenB).realQuote, bReal);
        assertEq(f.getMarket(tokenA).realQuote, 0);
        assertGt(f.reservedFees(), reservedBeforeGrad);
        assertGe(address(f).balance, f.getMarket(tokenB).realQuote + f.reservedFees());
        assertEq(f.claimable(alice) + f.claimable(bob) + f.claimable(TREASURY), f.reservedFees());
    }

    function test_tinyAndDustBuysAccrueWithoutInsolvency() public {
        address token = _createOn(factory, alice, bytes32("tiny"));
        vm.prank(charlie);
        factory.buy{value: 1}(token, 0, block.timestamp + 60);
        vm.prank(charlie);
        factory.buy{value: 101}(token, 0, block.timestamp + 60);
        vm.prank(charlie);
        factory.buy{value: 10 ether}(token, 1, block.timestamp + 60);
        assertEq(factory.reservedFees(), factory.claimable(alice) + factory.claimable(TREASURY));
        assertGe(address(factory).balance, factory.getMarket(token).realQuote + factory.reservedFees());
        (uint256 total,,) = FusedFeeMath.curveFee(10 ether + 101 + 1);
        assertEq(factory.reservedFees(), total);
    }

    function test_collectZeroThenRepeatDoesNotDoubleCount() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        address token = _createOn(f, alice, bytes32("zcol"));
        uint256 tokenId = _graduate(f, token, alice);
        (uint256 q0, uint256 t0) = l.collect(tokenId);
        assertEq(q0, 0);
        assertEq(t0, 0);
        uint128 liq = posm.getPositionLiquidity(tokenId);
        (uint256 q1, uint256 t1) = l.collect(tokenId);
        assertEq(q1, 0);
        assertEq(t1, 0);
        assertEq(posm.getPositionLiquidity(tokenId), liq);
        assertEq(posm.ownerOf(tokenId), address(l));
    }

    function test_oneSidedCarryThenRetryDoesNotDoubleCarry() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        address token = _createOn(f, alice, bytes32("oneside"));
        uint256 tokenId = _graduate(f, token, alice);
        vm.prank(charlie);
        f.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        l.collect(tokenId);
        uint256 carry1 = l.compoundCarry(tokenId, address(0));
        uint256 carryBeforeRetry = carry1;
        uint256 aliceBefore = alice.balance;
        uint256 treasuryBefore = TREASURY.balance;
        (uint256 quote2,) = l.collect(tokenId);
        assertEq(quote2, 0, "no new V4 fees to split");
        assertEq(alice.balance, aliceBefore);
        assertEq(TREASURY.balance, treasuryBefore);
        uint256 carry2 = l.compoundCarry(tokenId, address(0));
        assertLe(carry2, carryBeforeRetry);
        if (carryBeforeRetry > 0) {
            assertFalse(carry2 > carryBeforeRetry, "failed compound retry must not double carry");
        }
    }

    function test_compoundCarryIsNotPaidToCreatorOrTreasury() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        address token = _createOn(f, alice, bytes32("noclaim"));
        uint256 tokenId = _graduate(f, token, alice);
        vm.prank(charlie);
        f.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint256 aliceBefore = alice.balance;
        uint256 treasuryBefore = TREASURY.balance;
        (uint256 quoteOut,) = l.collect(tokenId);
        (uint256 cQ, uint256 tQ, uint256 kQ) = FusedFeeMath.v4Split(quoteOut);
        assertEq(alice.balance - aliceBefore, cQ);
        assertEq(TREASURY.balance - treasuryBefore, tQ);
        assertEq(l.claimable(alice, address(0)), 0);
        assertEq(l.claimable(TREASURY, address(0)), 0);
        uint256 carry = l.compoundCarry(tokenId, address(0));
        assertEq(cQ + tQ + kQ, quoteOut);
        assertLe(carry, kQ + 1);
        vm.prank(attacker);
        assertEq(l.claimFor(attacker, address(0)), 0);
        assertEq(l.claimFor(alice, address(0)), 0);
    }

    function test_crossMarketCompoundCarryIsolation() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        address tokenA = _createOn(f, alice, bytes32("isoA"));
        address tokenB = _createOn(f, bob, bytes32("isoB"));
        uint256 idA = _graduate(f, tokenA, alice);
        uint256 idB = _graduate(f, tokenB, bob);

        vm.prank(charlie);
        f.buy{value: 2 ether}(tokenA, 1, block.timestamp + 60);
        (uint256 aOut,) = l.collect(idA);
        (,, uint256 aCompound) = FusedFeeMath.v4Split(aOut);
        uint256 carryA = l.compoundCarry(idA, address(0));
        assertGt(aCompound, 0);
        assertGt(carryA, 0, "one-sided collect must leave per-position carry to isolate");
        uint256 bobBefore = bob.balance;

        vm.prank(charlie);
        f.buy{value: 1 ether}(tokenB, 1, block.timestamp + 60);
        (uint256 bOut,) = l.collect(idB);
        (uint256 bCreator,,) = FusedFeeMath.v4Split(bOut);

        assertEq(l.compoundCarry(idA, address(0)), carryA, "market A carry must not be consumed by market B collect");
        assertEq(bob.balance - bobBefore, bCreator, "B creator paid only B's 70% split");
        assertEq(posm.ownerOf(idA), address(l));
        assertEq(posm.ownerOf(idB), address(l));
        assertEq(l.creatorOf(idA), alice);
        assertEq(l.creatorOf(idB), bob);
        assertEq(l.treasuryOf(idA), TREASURY);
        assertEq(l.treasuryOf(idB), TREASURY);
    }

    function test_compoundFailureThenSuccessRetriesSamePosition() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        address token = _createOn(f, alice, bytes32("retryok"));
        uint256 tokenId = _graduate(f, token, alice);
        vm.prank(charlie);
        uint256 bought = f.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        l.collect(tokenId);
        uint256 carryAfterFail = l.compoundCarry(tokenId, address(0));
        vm.startPrank(charlie);
        LaunchToken(token).approve(address(f), bought / 2);
        f.sell(token, bought / 2, 1, block.timestamp + 60);
        vm.stopPrank();
        uint128 liqBefore = posm.getPositionLiquidity(tokenId);
        l.collect(tokenId);
        uint256 carryAfter = l.compoundCarry(tokenId, address(0));
        uint128 liqAfter = posm.getPositionLiquidity(tokenId);
        assertTrue(liqAfter > liqBefore || carryAfter > 0, "retry must compound or recarry");
        if (liqAfter > liqBefore && carryAfterFail > 0) {
            assertLe(carryAfter, carryAfterFail);
        }
        assertEq(posm.ownerOf(tokenId), address(l));
        assertGe(liqAfter, liqBefore);
    }

    function test_revertingCreatorDoesNotBlockOthersOrTreasury() public {
        RejectEther stuck = new RejectEther();
        vm.deal(address(stuck), 5 ether);
        address stuckToken = _createOn(factory, address(stuck), bytes32("blk-c"));
        address liveToken = _createOn(factory, alice, bytes32("blk-a"));
        vm.prank(charlie);
        factory.buy{value: 1 ether}(stuckToken, 1, block.timestamp + 60);
        vm.prank(charlie);
        factory.buy{value: 1 ether}(liveToken, 1, block.timestamp + 60);
        factory.claimFor(alice);
        factory.claimFor(TREASURY);
        assertEq(factory.claimable(alice), 0);
        assertEq(factory.claimable(TREASURY), 0);
        assertGt(factory.claimable(address(stuck)), 0);
        vm.prank(charlie);
        factory.buy{value: 0.01 ether}(stuckToken, 1, block.timestamp + 60);
    }

    function test_revertingTreasuryDoesNotStopTradingOrCreatorClaim() public {
        vm.etch(TREASURY, type(RejectEther).runtimeCode);
        address token = _createOn(factory, alice, bytes32("blk-t"));
        vm.prank(charlie);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        vm.prank(charlie);
        factory.buy{value: 0.5 ether}(token, 1, block.timestamp + 60);
        uint256 alicePaid = factory.claimFor(alice);
        assertGt(alicePaid, 0);
        vm.expectRevert(FusedFactoryV2.EthTransferFailed.selector);
        factory.claimFor(TREASURY);
        assertGt(factory.claimable(TREASURY), 0);
    }

    function test_reentrantCreatorDuringCollectIsCreditedNotFatal() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        FusedLocker l = f.locker();
        ReenterLockerCollect recv = new ReenterLockerCollect();
        vm.deal(address(recv), 5 ether);
        address token = _createOn(f, address(recv), bytes32("re-col"));
        uint256 tokenId = _graduate(f, token, charlie);
        recv.set(l, tokenId);
        vm.prank(charlie);
        f.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint128 liqBefore = posm.getPositionLiquidity(tokenId);
        uint256 recvBefore = address(recv).balance;
        (uint256 quoteOut,) = l.collect(tokenId);
        (uint256 cQ,,) = FusedFeeMath.v4Split(quoteOut);
        assertGe(posm.getPositionLiquidity(tokenId), liqBefore);
        assertEq(posm.ownerOf(tokenId), address(l));
        uint256 credited = l.claimable(address(recv), address(0));
        uint256 pushed = address(recv).balance - recvBefore;
        assertEq(credited + pushed, cQ, "reentrant creator is paid or credited, never both or neither");
        assertTrue(credited == 0 || pushed == 0);
        assertEq(recv.attempts(), 1);
    }

    function test_attackerCannotDrivePositionManagerAgainstLockerNft() public {
        FusedFactoryV2 f = _newFactory(0.1 ether);
        address token = _createOn(f, alice, bytes32("nft"));
        uint256 tokenId = _graduate(f, token, alice);
        FusedLocker locker_ = f.locker();
        uint128 liqBefore = posm.getPositionLiquidity(tokenId);
        bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(tokenId, uint256(1), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(address(0), token, attacker);
        vm.prank(attacker);
        vm.expectRevert();
        posm.modifyLiquidities(abi.encode(actions, params), block.timestamp);
        vm.prank(attacker);
        vm.expectRevert(FusedLocker.OnlySelf.selector);
        locker_.executeCompound(tokenId, address(0), token, 1, 0);
        assertEq(posm.ownerOf(tokenId), address(locker_));
        assertEq(posm.getPositionLiquidity(tokenId), liqBefore);
    }

    function test_v1UnchangedAndIsolatedFromV2() public {
        FusedFactory v1 = new FusedFactory(
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
        vm.prank(alice);
        address v1Token = v1.create(
            FusedFactory.CreateParams({
                name: "V1",
                symbol: "V1",
                metadataURI: "local://v1",
                salt: bytes32("v1iso"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        vm.prank(alice);
        uint256 out = v1.buy{value: 0.01 ether}(v1Token, 1, block.timestamp + 60);
        assertGt(out, 0);
        assertEq(v1.getMarket(v1Token).realQuote, 0.01 ether);
        vm.prank(alice);
        vm.expectRevert(FusedFactoryV2.UnknownMarket.selector);
        factory.buy{value: 0.01 ether}(v1Token, 1, block.timestamp + 60);
        address v2Token = _createOn(factory, alice, bytes32("v2iso"));
        vm.prank(alice);
        vm.expectRevert(FusedFactory.UnknownMarket.selector);
        v1.buy{value: 0.01 ether}(v2Token, 1, block.timestamp + 60);
    }

    function testFuzz_curveReservedMatchesLiabilities(uint96 aAmt, uint96 bAmt) public {
        aAmt = uint96(bound(aAmt, 0.0001 ether, 1 ether));
        bAmt = uint96(bound(bAmt, 0.0001 ether, 1 ether));
        address tokenA = _createOn(factory, alice, bytes32(uint256(aAmt) + 1));
        address tokenB = _createOn(factory, bob, bytes32(uint256(bAmt) + 2));
        vm.prank(charlie);
        factory.buy{value: aAmt}(tokenA, 0, block.timestamp + 60);
        vm.prank(charlie);
        factory.buy{value: bAmt}(tokenB, 0, block.timestamp + 60);
        uint256 reserved = factory.reservedFees();
        assertEq(reserved, factory.claimable(alice) + factory.claimable(bob) + factory.claimable(TREASURY));
        uint256 needed = reserved + factory.getMarket(tokenA).realQuote + factory.getMarket(tokenB).realQuote;
        assertEq(address(factory).balance, needed);
        (uint256 fa,,) = FusedFeeMath.curveFee(aAmt);
        (uint256 fb,,) = FusedFeeMath.curveFee(bAmt);
        assertEq(reserved, fa + fb);
    }
}
