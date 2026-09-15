// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FusedUsdcConvert} from "src/fused/FusedUsdcConvert.sol";

contract ConvertHarness {
    function toErc20(uint256 amount18) external pure returns (uint256) {
        return FusedUsdcConvert.toErc20(amount18);
    }

    function dust18(uint256 amount18) external pure returns (uint256) {
        return FusedUsdcConvert.dust18(amount18);
    }

    function requireErc20(uint256 amount18) external pure returns (uint256) {
        return FusedUsdcConvert.requireErc20(amount18);
    }

    function scale() external pure returns (uint256) {
        return FusedUsdcConvert.scale();
    }
}

contract FusedUsdcConvertTest is Test {
    ConvertHarness harness;

    function setUp() public {
        harness = new ConvertHarness();
    }

    function test_scaleIs1e12() public view {
        assertEq(harness.scale(), 1e12);
    }

    function test_oneUsdc() public view {
        uint256 amount18 = 1 ether;
        assertEq(harness.toErc20(amount18), 1_000_000);
        assertEq(harness.dust18(amount18), 0);
        assertEq(harness.requireErc20(amount18), 1_000_000);
        assertEq(harness.toErc20(amount18) * 1e12 + harness.dust18(amount18), amount18);
    }

    function test_oneCentUsdc() public view {
        uint256 amount18 = 0.01 ether;
        assertEq(harness.toErc20(amount18), 10_000);
        assertEq(harness.dust18(amount18), 0);
        assertEq(harness.toErc20(amount18) * 1e12, amount18);
    }

    function test_oneMillionthUsdc() public view {
        uint256 amount18 = 1e12;
        assertEq(harness.toErc20(amount18), 1);
        assertEq(harness.dust18(amount18), 0);
        assertEq(harness.requireErc20(amount18), 1);
    }

    function test_belowOneMillionthRoundsDownToZero() public {
        uint256 amount18 = 1e12 - 1;
        assertEq(harness.toErc20(amount18), 0);
        assertEq(harness.dust18(amount18), amount18);
        vm.expectRevert(FusedUsdcConvert.ZeroOutputConversion.selector);
        harness.requireErc20(amount18);
        vm.expectRevert(FusedUsdcConvert.ZeroOutputConversion.selector);
        harness.requireErc20(0);
        vm.expectRevert(FusedUsdcConvert.ZeroOutputConversion.selector);
        harness.requireErc20(1);
    }

    function test_fiftyThousandUsdc() public view {
        uint256 amount18 = 50_000 ether;
        assertEq(harness.toErc20(amount18), 50_000 * 1e6);
        assertEq(harness.dust18(amount18), 0);
        assertEq(harness.toErc20(amount18) * 1e12 + harness.dust18(amount18), amount18);
    }

    function test_dustExamples() public view {
        uint256 amount18 = 1 ether + 123456789012;
        assertEq(harness.toErc20(amount18), 1_000_000);
        assertEq(harness.dust18(amount18), 123456789012);
        assertEq(harness.toErc20(amount18) * 1e12 + harness.dust18(amount18), amount18);
        assertTrue(harness.toErc20(amount18) * 1e12 <= amount18);
    }

    function test_neverInflatesBy1e12() public view {
        uint256[5] memory samples = [uint256(1), 1e12 - 1, 1 ether, 50_000 ether, type(uint128).max];
        for (uint256 i; i < samples.length; ++i) {
            uint256 amount18 = samples[i];
            uint256 amount6 = harness.toErc20(amount18);
            uint256 dust = harness.dust18(amount18);
            assertEq(amount6 * 1e12 + dust, amount18, "identity");
            assertTrue(amount6 * 1e12 <= amount18, "no inflation");
            assertTrue(dust < 1e12, "dust in range");
        }
    }

    function testFuzz_identityAndFloor(uint256 amount18) public view {
        amount18 = bound(amount18, 0, type(uint256).max / 1e12);
        uint256 amount6 = harness.toErc20(amount18);
        uint256 dust = harness.dust18(amount18);
        assertEq(amount6, amount18 / 1e12);
        assertEq(dust, amount18 % 1e12);
        assertEq(amount6 * 1e12 + dust, amount18);
        assertTrue(amount6 * 1e12 <= amount18);
        if (amount6 > 0) {
            assertEq(harness.requireErc20(amount18), amount6);
        }
    }

    function testFuzz_requireRevertsBelowOneUnit(uint256 amount18) public {
        amount18 = bound(amount18, 0, 1e12 - 1);
        vm.expectRevert(FusedUsdcConvert.ZeroOutputConversion.selector);
        harness.requireErc20(amount18);
    }
}
