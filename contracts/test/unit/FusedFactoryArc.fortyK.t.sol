// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {FusedCurveMath} from "src/fused/FusedCurveMath.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";
import {FusedUsdcConvert} from "src/fused/FusedUsdcConvert.sol";

/// @notice Scale 14k/35k ($122,500 MC) to ~$40,000 circulating MC at the same 0.4 ratio.
contract FusedFactoryArcFortyKGeometryTest is Test {
    uint256 internal constant SUPPLY = 1_000_000_000 ether;
    uint256 internal constant WANT_MC = 40_000 ether;

    function _minGross(uint256 netTarget) internal pure returns (uint256) {
        return (netTarget * 100 + 98) / 99;
    }

    function _shape(uint256 vq, uint256 target)
        internal
        pure
        returns (
            uint256 gross,
            uint256 net,
            uint256 tokensSold,
            uint256 remaining,
            uint256 usdc6,
            uint256 dust,
            uint256 priceX18,
            uint256 circulatingMc,
            uint256 fdv,
            uint256 tvl,
            uint256 soldBps
        )
    {
        gross = _minGross(target);
        (uint256 feeTotal,,) = FusedFeeMath.curveFee(gross);
        net = gross - feeTotal;
        uint256 newT;
        (tokensSold,, newT) = FusedCurveMath.buyOut(vq, SUPPLY, SUPPLY, net);
        remaining = SUPPLY - tokensSold;
        usdc6 = FusedUsdcConvert.requireErc20(net);
        dust = FusedUsdcConvert.dust18(net);
        priceX18 = FusedCurveMath.priceX18(vq + net, newT);
        circulatingMc = (tokensSold * priceX18) / 1e18;
        fdv = (SUPPLY * priceX18) / 1e18;
        tvl = (remaining * priceX18) / 1e18 + net;
        soldBps = (tokensSold * 10_000) / SUPPLY;
    }

    function test_scaleToFortyThousandCirculatingMc() public pure {
        // Exact 0.4 ratio: target = 5*vq/2. Closest even vq to 40000/3.5 * 0.4 ether.
        uint256 vq = 4_571_428_571_428_571_428_570;
        uint256 target = (uint256(5) * vq) / 2;
        assertEq(vq * 5, target * 2);
        assertTrue(vq % 2 == 0);

        (
            uint256 gross,
            uint256 net,
            uint256 tokensSold,
            uint256 remaining,
            uint256 usdc6,
            uint256 dust,
            uint256 priceX18,
            uint256 circulatingMc,
            uint256 fdv,
            uint256 tvl,
            uint256 soldBps
        ) = _shape(vq, target);

        assertGe(net, target);
        assertEq(soldBps, 7142);
        assertGe(circulatingMc, 39_990 ether);
        assertLe(circulatingMc, 40_010 ether);
        assertEq(usdc6 * 1e12 + dust, net);

        assertEq(vq, 4_571_428_571_428_571_428_570);
        assertEq(target, 11_428_571_428_571_428_571_425);
        assertEq(gross, 11_544_011_544_011_544_011_541);
        assertEq(net, 11_428_571_428_571_428_571_426);
        assertEq(tokensSold, 714_285_714_285_714_285_714_303_571);
        assertEq(remaining, 285_714_285_714_285_714_285_696_429);
        assertEq(usdc6, 11_428_571_428);
        assertEq(dust, 571_428_571_426);
        assertEq(priceX18, 55_999_999_999_999);
        assertEq(circulatingMc, 39_999_999_999_999_285_714_286);
        assertEq(fdv, 55_999_999_999_999_000_000_000);
        assertEq(tvl, 27_428_571_428_571_142_857_139);
    }

    function test_logFortyKIfExactAssertsDrift() public {
        uint256 vq = 4_571_428_571_428_571_428_570;
        uint256 target = (uint256(5) * vq) / 2;
        (
            uint256 gross,
            uint256 net,
            uint256 tokensSold,
            uint256 remaining,
            uint256 usdc6,
            uint256 dust,
            uint256 priceX18,
            uint256 circulatingMc,
            uint256 fdv,
            uint256 tvl,
            uint256 soldBps
        ) = _shape(vq, target);
        console2.log("vq", vq);
        console2.log("target", target);
        console2.log("gross", gross);
        console2.log("net", net);
        console2.log("tokensSold", tokensSold);
        console2.log("remaining", remaining);
        console2.log("usdc6", usdc6);
        console2.log("dust", dust);
        console2.log("priceX18", priceX18);
        console2.log("circulatingMc", circulatingMc);
        console2.log("fdv", fdv);
        console2.log("tvl", tvl);
        console2.log("soldBps", soldBps);
        assertTrue(true);
    }
}
