// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FusedCurveMath} from "src/fused/FusedCurveMath.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";
import {FusedUsdcConvert} from "src/fused/FusedUsdcConvert.sol";

/// @notice Production Arc 14k/35k geometry must match Robinhood 1.68/4.2 (ratio 0.4, ~71.43% sold).
contract FusedFactoryArcCurveGeometryTest is Test {
    uint256 internal constant VIRTUAL_QUOTE = 14_000 ether;
    uint256 internal constant VIRTUAL_TOKEN = 1_000_000_000 ether;
    uint256 internal constant GRADUATION_TARGET = 35_000 ether;
    uint256 internal constant SUPPLY = 1_000_000_000 ether;

    function _minGross(uint256 netTarget) internal pure returns (uint256) {
        return (netTarget * 100 + 98) / 99;
    }

    function test_ratioMatchesRobinhoodPonsGeometry() public pure {
        assertEq(VIRTUAL_QUOTE * 5, GRADUATION_TARGET * 2);
        assertEq(VIRTUAL_QUOTE * 1e18 / GRADUATION_TARGET, 0.4 ether);
        assertEq(168 ether * GRADUATION_TARGET, 420 ether * VIRTUAL_QUOTE);
    }

    function test_productionBuyToGraduationShape() public pure {
        uint256 gross = _minGross(GRADUATION_TARGET);
        (uint256 feeTotal, uint256 creatorFee, uint256 treasuryFee) = FusedFeeMath.curveFee(gross);
        uint256 net = gross - feeTotal;
        assertGe(net, GRADUATION_TARGET);
        assertEq(feeTotal, creatorFee + treasuryFee);
        assertEq(creatorFee, (feeTotal * 30) / 100);
        assertEq(treasuryFee, feeTotal - creatorFee);

        (uint256 tokensSold, uint256 newQ, uint256 newT) =
            FusedCurveMath.buyOut(VIRTUAL_QUOTE, VIRTUAL_TOKEN, SUPPLY, net);
        uint256 remaining = SUPPLY - tokensSold;
        assertEq(remaining, newT);
        assertEq(newQ, VIRTUAL_QUOTE + net);

        uint256 soldBps = (tokensSold * 10_000) / SUPPLY;
        uint256 remainBps = (remaining * 10_000) / SUPPLY;
        assertEq(soldBps, 7142);
        assertEq(remainBps, 2857);
        assertGe(soldBps, 7100);
        assertLe(soldBps, 7200);

        uint256 usdc6 = FusedUsdcConvert.requireErc20(net);
        uint256 dust = FusedUsdcConvert.dust18(net);
        assertEq(usdc6 * 1e12 + dust, net);
        assertTrue(usdc6 * 1e12 <= net);

        uint256 priceX18 = FusedCurveMath.priceX18(newQ, newT);
        uint256 circulatingMc = (tokensSold * priceX18) / 1e18;
        uint256 fdv = (SUPPLY * priceX18) / 1e18;
        uint256 tokenSide = (remaining * priceX18) / 1e18;
        uint256 tvl = tokenSide + net;

        assertGt(circulatingMc, GRADUATION_TARGET);
        assertGt(fdv, circulatingMc);
        assertGt(tvl, net);

        assertEq(gross, 35_353_535_353_535_353_535_354);
        assertEq(net, 35_000_000_000_000_000_000_001);
        assertEq(feeTotal, 353_535_353_535_353_535_353);
        assertEq(creatorFee, 106_060_606_060_606_060_605);
        assertEq(treasuryFee, 247_474_747_474_747_474_748);
        assertEq(usdc6, 35_000_000_000);
        assertEq(dust, 1);
        assertEq(tokensSold, 714_285_714_285_714_285_714_291_545);
        assertEq(remaining, 285_714_285_714_285_714_285_708_455);
        assertEq(priceX18, 171_500_000_000_000);
        assertEq(circulatingMc, 122_500_000_000_000_000_000_000);
        assertEq(fdv, 171_500_000_000_000_000_000_000);
        assertEq(tvl, 84_000_000_000_000_000_000_000);
    }
}
