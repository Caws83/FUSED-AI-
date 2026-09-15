// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PositionManager} from "@uniswap/v4-periphery/src/PositionManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPositionDescriptor} from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";

import {FusedFactoryArc} from "src/fused/FusedFactoryArc.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {LaunchToken} from "src/LaunchToken.sol";

contract MockUsdc6 is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract RejectQuote {
    fallback() external payable {
        revert("nope");
    }

    receive() external payable {
        revert("nope");
    }
}

contract ReenterClaim {
    FusedFactoryArc public factory;
    uint256 public innerAttempts;

    function setFactory(FusedFactoryArc f) external {
        factory = f;
    }

    receive() external payable {
        innerAttempts++;
        try factory.claim() {} catch {}
    }
}

contract EvilUsdc is ERC20 {
    bool public failTransfer;

    constructor() ERC20("Evil", "EVL") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFail(bool v) external {
        failTransfer = v;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (failTransfer) return false;
        return super.transfer(to, value);
    }

    function approve(address, uint256) public pure override returns (bool) {
        return false;
    }
}

contract FusedFactoryArcSecurityTest is Test, DeployPermit2 {
    MockUsdc6 usdc;
    FusedFactoryArc factory;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");
    address constant TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;

    function setUp() public {
        usdc = new MockUsdc6();
        factory = new FusedFactoryArc(
            IPoolManager(address(0)),
            IPositionManager(address(0)),
            IAllowanceTransfer(address(0)),
            FusedFactoryArc.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 0.01 ether,
                treasury: TREASURY,
                lpFee: 10_000
            }),
            address(usdc)
        );
        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
        vm.deal(attacker, 50 ether);
    }

    function _create(address who, bytes32 salt) internal returns (address token) {
        vm.prank(who);
        token = factory.create(
            FusedFactoryArc.CreateParams({
                name: "S",
                symbol: "S",
                metadataURI: "local://s",
                salt: salt,
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
    }

    function test_reentrantClaimCannotDoublePay() public {
        ReenterClaim re = new ReenterClaim();
        re.setFactory(factory);
        vm.deal(address(re), 1 ether);
        address token = _create(address(re), bytes32("re"));
        vm.prank(bob);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint256 credited = factory.claimable(address(re));
        assertEq(credited, 0.003 ether);
        uint256 before = address(re).balance;
        factory.claimFor(address(re));
        assertEq(factory.claimable(address(re)), 0);
        assertEq(address(re).balance, before + credited);
        assertEq(re.innerAttempts(), 1);
    }

    function test_failedClaimPreservesAccounting() public {
        RejectQuote stuck = new RejectQuote();
        vm.deal(address(stuck), 5 ether);
        address token = _create(address(stuck), bytes32("fail"));
        vm.prank(bob);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        uint256 credited = factory.claimable(address(stuck));
        uint256 reserved = factory.reservedFees();
        vm.expectRevert(FusedFactoryArc.QuoteTransferFailed.selector);
        factory.claimFor(address(stuck));
        assertEq(factory.claimable(address(stuck)), credited);
        assertEq(factory.reservedFees(), reserved);
    }

    function test_unknownTokenCannotTradeOrGraduate() public {
        vm.expectRevert(FusedFactoryArc.UnknownMarket.selector);
        factory.buy{value: 0.01 ether}(address(0x1234), 1, block.timestamp + 60);
        vm.expectRevert(FusedFactoryArc.NotCurve.selector);
        factory.graduate(address(0x1234));
    }

    function test_cannotGraduateEarly() public {
        address token = _create(alice, bytes32("early"));
        vm.expectRevert(FusedFactoryArc.NotReadyToGraduate.selector);
        factory.graduate(token);
    }

    function test_cannotGraduateWithoutDexEvenWhenReady() public {
        address token = _create(alice, bytes32("nodex"));
        vm.prank(alice);
        factory.buy{value: uint256(0.01 ether) * 10_000 / 9_900}(token, 1, block.timestamp + 60);
        vm.expectRevert(FusedFactoryArc.DexUnavailable.selector);
        factory.graduate(token);
        assertEq(factory.getMarket(token).state, factory.STATE_CURVE());
    }

    function test_attackerCannotStealLpBecauseNoneExistsOnTestnetPath() public {
        address token = _create(alice, bytes32("lp"));
        vm.prank(alice);
        factory.buy{value: uint256(0.01 ether) * 10_000 / 9_900}(token, 1, block.timestamp + 60);
        assertEq(factory.getMarket(token).tokenId, 0);
        FusedLocker locker = factory.locker();
        vm.prank(attacker);
        vm.expectRevert(FusedLocker.NotFactory.selector);
        locker.register(1, token, address(usdc), attacker, attacker);
    }

    function test_erc20ApproveFailureRevertsGraduationAtomically() public {
        EvilUsdc evil = new EvilUsdc();
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer p2 = IAllowanceTransfer(deployPermit2());
        PositionManager posm =
            new PositionManager(manager, p2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        FusedFactoryArc f = new FusedFactoryArc(
            manager,
            posm,
            p2,
            FusedFactoryArc.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 0.01 ether,
                treasury: TREASURY,
                lpFee: 10_000
            }),
            address(evil)
        );
        vm.prank(alice);
        address token = f.create(
            FusedFactoryArc.CreateParams({
                name: "E",
                symbol: "E",
                metadataURI: "local://e",
                salt: bytes32("e"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        evil.mint(address(f), 1_000_000);
        evil.setFail(true);
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        vm.expectRevert();
        f.buy{value: uint256(0.01 ether) * 10_000 / 9_900}(token, 1, block.timestamp + 60);
        assertEq(f.getMarket(token).state, f.STATE_CURVE());
        assertEq(alice.balance, aliceBefore);
        assertEq(LaunchToken(token).balanceOf(alice), 0);
    }

    function test_insufficientQuoteTokenRevertsAtomically() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer p2 = IAllowanceTransfer(deployPermit2());
        PositionManager posm =
            new PositionManager(manager, p2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        FusedFactoryArc f = new FusedFactoryArc(
            manager,
            posm,
            p2,
            FusedFactoryArc.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 0.01 ether,
                treasury: TREASURY,
                lpFee: 10_000
            }),
            address(usdc)
        );
        vm.prank(alice);
        address token = f.create(
            FusedFactoryArc.CreateParams({
                name: "Q",
                symbol: "Q",
                metadataURI: "local://q",
                salt: bytes32("q"),
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        vm.expectRevert(FusedFactoryArc.InsufficientQuoteToken.selector);
        f.buy{value: uint256(0.01 ether) * 10_000 / 9_900}(token, 1, block.timestamp + 60);
        assertEq(f.getMarket(token).state, f.STATE_CURVE());
        assertEq(alice.balance, aliceBefore);
    }

    function test_creatorImmutableAndNoSetCreator() public {
        address token = _create(alice, bytes32("c"));
        (bool ok,) = address(factory).call(abi.encodeWithSignature("setCreator(address,address)", token, attacker));
        assertFalse(ok);
        vm.prank(bob);
        factory.buy{value: 0.01 ether}(token, 1, block.timestamp + 60);
        assertEq(factory.creatorOf(token), alice);
        assertEq(factory.claimable(alice), (0.01 ether * 30) / 10_000);
        assertEq(factory.claimable(bob), 0);
    }
}
