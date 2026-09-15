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
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {FusedFactoryArc} from "src/fused/FusedFactoryArc.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";
import {FusedUsdcConvert} from "src/fused/FusedUsdcConvert.sol";
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

contract MockUsdcWrongDecimals is ERC20 {
    constructor() ERC20("Wrong", "W") {}
}

contract RejectQuote {
    fallback() external payable {
        revert("nope");
    }

    receive() external payable {
        revert("nope");
    }
}

contract RevertingPoolManager {
    function initialize(PoolKey calldata, uint160) external pure {
        revert("no dex");
    }
}

contract FusedFactoryArcTest is Test, DeployPermit2 {
    MockUsdc6 usdc;
    FusedFactoryArc factory;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");
    address constant TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;

    function setUp() public {
        usdc = new MockUsdc6();
        factory = _curveOnly(0.01 ether);
        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
        vm.deal(attacker, 50 ether);
    }

    function _curveParams(uint256 target) internal pure returns (FusedFactoryArc.CurveParams memory) {
        return FusedFactoryArc.CurveParams({
            virtualQuote: 0.05 ether,
            virtualToken: 1_000_000_000 ether,
            graduationTarget: target,
            treasury: TREASURY,
            lpFee: 10_000
        });
    }

    function _curveOnly(uint256 target) internal returns (FusedFactoryArc) {
        return new FusedFactoryArc(
            IPoolManager(address(0)),
            IPositionManager(address(0)),
            IAllowanceTransfer(address(0)),
            _curveParams(target),
            address(usdc)
        );
    }

    function _createOn(FusedFactoryArc f, address who, bytes32 salt) internal returns (address token) {
        vm.prank(who);
        token = f.create(
            FusedFactoryArc.CreateParams({
                name: "Arc Coin",
                symbol: "ARC",
                metadataURI: "local://arc",
                salt: salt,
                minTokensOut: 0,
                deadline: block.timestamp + 60
            })
        );
    }

    function test_feeConstantsAreExact() public view {
        assertEq(factory.MAX_FEE_BPS(), 100);
        assertEq(factory.feeBps(), 100);
        assertEq(factory.creatorFeeBps(), 30);
        assertEq(factory.treasuryFeeBps(), 70);
        assertEq(uint256(factory.creatorFeeBps()) + factory.treasuryFeeBps(), factory.MAX_FEE_BPS());
        assertEq(factory.NATIVE_TO_ERC20(), 1e12);
        assertFalse(factory.dexEnabled());
    }

    function test_wrongTreasuryReverts() public {
        vm.expectRevert(FusedFactoryArc.BadTreasury.selector);
        new FusedFactoryArc(
            IPoolManager(address(0)),
            IPositionManager(address(0)),
            IAllowanceTransfer(address(0)),
            FusedFactoryArc.CurveParams({
                virtualQuote: 0.05 ether,
                virtualToken: 1_000_000_000 ether,
                graduationTarget: 0.01 ether,
                treasury: attacker,
                lpFee: 10_000
            }),
            address(usdc)
        );
    }

    function test_wrongDecimalsReverts() public {
        MockUsdcWrongDecimals bad = new MockUsdcWrongDecimals();
        vm.expectRevert(FusedFactoryArc.BadQuoteToken.selector);
        new FusedFactoryArc(
            IPoolManager(address(0)),
            IPositionManager(address(0)),
            IAllowanceTransfer(address(0)),
            _curveParams(0.01 ether),
            address(bad)
        );
    }

    function test_partialDexConfigReverts() public {
        vm.expectRevert(FusedFactoryArc.BadDexConfig.selector);
        new FusedFactoryArc(
            IPoolManager(address(1)),
            IPositionManager(address(0)),
            IAllowanceTransfer(address(0)),
            _curveParams(0.01 ether),
            address(usdc)
        );
    }

    function test_refusesRobinhoodChainIds() public {
        vm.chainId(46630);
        vm.expectRevert(FusedFactoryArc.UnsupportedChain.selector);
        _curveOnly(0.01 ether);
        vm.chainId(4663);
        vm.expectRevert(FusedFactoryArc.UnsupportedChain.selector);
        _curveOnly(0.01 ether);
    }

    function test_arcTestnetRefusesDexConfig() public {
        vm.chainId(5042002);
        assertEq(block.chainid, 5042002);
        address usdcPrecompile = address(uint160(0x3600000000000000000000000000000000000000));
        vm.expectRevert(FusedFactoryArc.DexUnavailable.selector);
        new FusedFactoryArc(
            IPoolManager(address(1)),
            IPositionManager(address(2)),
            IAllowanceTransfer(address(3)),
            _curveParams(0.01 ether),
            usdcPrecompile
        );
    }

    function test_arcTestnetRequiresCanonicalUsdc() public {
        vm.chainId(5042002);
        vm.expectRevert(FusedFactoryArc.BadQuoteToken.selector);
        new FusedFactoryArc(
            IPoolManager(address(0)),
            IPositionManager(address(0)),
            IAllowanceTransfer(address(0)),
            _curveParams(0.01 ether),
            address(usdc)
        );
    }

    function test_createBuySellAndFeeSplit() public {
        address token = _createOn(factory, alice, bytes32("curve"));
        vm.prank(alice);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);

        assertEq(factory.claimable(alice), 0.003 ether);
        assertEq(factory.claimable(TREASURY), 0.007 ether);
        assertEq(factory.reservedFees(), 0.01 ether);
        assertEq(factory.getMarket(token).realQuote, 0.99 ether);
        assertEq(address(factory).balance, 1 ether);
        assertEq(factory.getMarket(token).state, factory.STATE_CURVE());

        uint256 bought = LaunchToken(token).balanceOf(alice);
        vm.startPrank(alice);
        LaunchToken(token).approve(address(factory), bought / 2);
        uint256 sold = factory.sell(token, bought / 2, 1, block.timestamp + 60);
        vm.stopPrank();
        assertGt(sold, 0);
        assertEq(factory.claimable(alice) + factory.claimable(TREASURY), factory.reservedFees());
        assertGe(address(factory).balance, factory.getMarket(token).realQuote + factory.reservedFees());
    }

    function test_reservedFeesExcludedFromCurveLiquidity() public {
        address token = _createOn(factory, alice, bytes32("res"));
        vm.prank(bob);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);
        assertEq(factory.getMarket(token).realQuote, 0.99 ether);
        assertEq(factory.reservedFees(), 0.01 ether);
        assertEq(address(factory).balance, factory.getMarket(token).realQuote + factory.reservedFees());
    }

    function test_claimAndClaimForCannotRedirect() public {
        address token = _createOn(factory, alice, bytes32("claim"));
        vm.prank(bob);
        factory.buy{value: 1 ether}(token, 1, block.timestamp + 60);

        uint256 aliceBefore = alice.balance;
        uint256 attackerBefore = attacker.balance;
        uint256 treasuryBefore = TREASURY.balance;
        vm.prank(attacker);
        uint256 paid = factory.claimFor(alice);
        assertEq(paid, 0.003 ether);
        assertEq(alice.balance, aliceBefore + 0.003 ether);
        assertEq(attacker.balance, attackerBefore);
        vm.prank(attacker);
        uint256 treas = factory.claimFor(TREASURY);
        assertEq(treas, 0.007 ether);
        assertEq(TREASURY.balance, treasuryBefore + 0.007 ether);
        assertEq(attacker.balance, attackerBefore);
        vm.prank(attacker);
        assertEq(factory.claimFor(attacker), 0);
    }

    function test_deadlineAndSlippageAndZeroValue() public {
        address token = _createOn(factory, alice, bytes32("dl"));
        vm.prank(bob);
        vm.expectRevert(FusedFactoryArc.DeadlineExpired.selector);
        factory.buy{value: 0.01 ether}(token, 1, block.timestamp - 1);
        vm.prank(bob);
        vm.expectRevert(FusedFactoryArc.ZeroValue.selector);
        factory.buy{value: 0}(token, 0, block.timestamp + 60);
        vm.prank(bob);
        vm.expectRevert(FusedFactoryArc.Slippage.selector);
        factory.buy{value: 0.01 ether}(token, type(uint256).max, block.timestamp + 60);
    }

    function test_testnetGraduationStaysOnCurve() public {
        address token = _createOn(factory, alice, bytes32("ready"));
        uint256 quote = uint256(0.01 ether) * 10_000 / 9_900;
        vm.prank(alice);
        factory.buy{value: quote}(token, 1, block.timestamp + 60);

        FusedFactoryArc.MarketView memory market = factory.getMarket(token);
        assertEq(market.state, factory.STATE_CURVE());
        assertTrue(factory.isGraduationReady(token));
        assertTrue(factory.graduationReadyEmitted(token));
        assertEq(market.tokenId, 0);
        assertGt(market.realQuote, 0);
        assertGe(address(factory).balance, market.realQuote + factory.reservedFees());

        vm.expectRevert(FusedFactoryArc.DexUnavailable.selector);
        factory.graduate(token);
        assertEq(factory.getMarket(token).state, factory.STATE_CURVE());

        vm.prank(bob);
        uint256 more = factory.buy{value: 0.001 ether}(token, 1, block.timestamp + 60);
        assertGt(more, 0);
        assertEq(factory.getMarket(token).state, factory.STATE_CURVE());
    }

    function test_poolKeyUnavailableWithoutDex() public {
        address token = _createOn(factory, alice, bytes32("key"));
        vm.expectRevert(FusedFactoryArc.DexUnavailable.selector);
        factory.poolKeyOf(token);
    }

    function test_noOwnerOrAdminBackdoor() public {
        (bool a,) = address(factory).staticcall(abi.encodeWithSignature("owner()"));
        (bool b,) = address(factory.locker()).staticcall(abi.encodeWithSignature("owner()"));
        (bool c,) = address(factory).call(abi.encodeWithSignature("setTreasury(address)", attacker));
        (bool d,) = address(factory).call(abi.encodeWithSignature("withdraw(address,uint256)", attacker, 1));
        assertFalse(a);
        assertFalse(b);
        assertFalse(c);
        assertFalse(d);
    }

    function test_sellNativeTransferFailureRevertsAtomically() public {
        RejectQuote stuck = new RejectQuote();
        vm.deal(address(stuck), 5 ether);
        address token = _createOn(factory, alice, bytes32("xfer"));
        vm.prank(alice);
        uint256 bought = factory.buy{value: 0.05 ether}(token, 1, block.timestamp + 60);
        vm.prank(alice);
        LaunchToken(token).transfer(address(stuck), bought / 2);
        vm.startPrank(address(stuck));
        LaunchToken(token).approve(address(factory), bought / 2);
        vm.expectRevert();
        factory.sell(token, bought / 2, 1, block.timestamp + 60);
        vm.stopPrank();
        assertEq(factory.getMarket(token).state, factory.STATE_CURVE());
    }

    function test_failedGraduationDoesNotMarkGraduated() public {
        IAllowanceTransfer p2 = IAllowanceTransfer(deployPermit2());
        RevertingPoolManager badPm = new RevertingPoolManager();
        PositionManager posm = new PositionManager(
            IPoolManager(address(new PoolManager(address(this)))),
            p2,
            50_000,
            IPositionDescriptor(address(0)),
            IWETH9(address(0))
        );
        FusedFactoryArc f = new FusedFactoryArc(
            IPoolManager(address(badPm)), posm, p2, _curveParams(0.01 ether), address(usdc)
        );
        address token = _createOn(f, alice, bytes32("fail-g"));
        uint256 quote = uint256(0.01 ether) * 10_000 / 9_900;
        usdc.mint(address(f), 1_000_000);
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        vm.expectRevert();
        f.buy{value: quote}(token, 1, block.timestamp + 60);
        assertEq(f.getMarket(token).state, f.STATE_CURVE());
        assertEq(f.getMarket(token).tokenId, 0);
        assertEq(alice.balance, aliceBefore);
        assertEq(LaunchToken(token).balanceOf(alice), 0);
    }

    function test_zeroOutputConversionRevertsAtomically() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer p2 = IAllowanceTransfer(deployPermit2());
        PositionManager posm =
            new PositionManager(manager, p2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        FusedFactoryArc f = new FusedFactoryArc(manager, posm, p2, _curveParams(1), address(usdc));
        address token = _createOn(f, alice, bytes32("dust"));
        vm.prank(alice);
        vm.expectRevert(FusedUsdcConvert.ZeroOutputConversion.selector);
        f.buy{value: 1}(token, 0, block.timestamp + 60);
        assertEq(f.getMarket(token).state, f.STATE_CURVE());
        assertEq(f.getMarket(token).realQuote, 0);
    }

    function test_productionGraduationUsesErc20UsdcNotNative() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        IAllowanceTransfer p2 = IAllowanceTransfer(deployPermit2());
        PositionManager posm =
            new PositionManager(manager, p2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        FusedFactoryArc f = new FusedFactoryArc(manager, posm, p2, _curveParams(0.1 ether), address(usdc));
        FusedLocker l = f.locker();
        address token = _createOn(f, alice, bytes32("v4"));
        uint256 quote = uint256(0.1 ether) * 10_000 / 9_900;
        usdc.mint(address(f), 1_000_000);
        vm.prank(alice);
        f.buy{value: quote}(token, 1, block.timestamp + 60);

        FusedFactoryArc.MarketView memory market = f.getMarket(token);
        assertEq(market.state, f.STATE_GRADUATED());
        assertGt(market.tokenId, 0);
        assertEq(posm.ownerOf(market.tokenId), address(l));
        assertEq(l.quoteOf(market.tokenId), address(usdc));
        assertTrue(l.quoteOf(market.tokenId) != address(0));
        PoolKey memory key = f.poolKeyOf(token);
        assertTrue(Currency.unwrap(key.currency0) != address(0));
        assertTrue(Currency.unwrap(key.currency1) != address(0));
        assertTrue(
            Currency.unwrap(key.currency0) == address(usdc) || Currency.unwrap(key.currency1) == address(usdc)
        );
        assertGe(address(f).balance, f.reservedFees());
        vm.expectRevert(FusedFactoryArc.NotCurve.selector);
        f.graduate(token);
        vm.prank(alice);
        vm.expectRevert(FusedFactoryArc.NativeNotAcceptedAfterGraduation.selector);
        f.buy{value: 0.01 ether}(token, 1, block.timestamp + 60);
    }
}
