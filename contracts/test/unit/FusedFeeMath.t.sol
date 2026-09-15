// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";

contract FusedFeeMathTest is Test {
    function test_curveSplit_exact30_70_on1Ether() public pure {
        (uint256 total, uint256 creator, uint256 treasury) = FusedFeeMath.curveFee(1 ether);
        assertEq(total, 0.01 ether);
        assertEq(creator, 0.003 ether);
        assertEq(treasury, 0.007 ether);
        assertEq(creator + treasury, total);
    }

    function test_v4Split_exact70_10_20_on1Ether() public pure {
        (uint256 creator, uint256 treasury, uint256 compound) = FusedFeeMath.v4Split(1 ether);
        assertEq(creator, 0.70 ether);
        assertEq(treasury, 0.10 ether);
        assertEq(compound, 0.20 ether);
        assertEq(creator + treasury + compound, 1 ether);
    }

    function testFuzz_curveFeeSumsAndCap(uint256 amount) public pure {
        amount = bound(amount, 0, type(uint128).max);
        (uint256 total, uint256 creator, uint256 treasury) = FusedFeeMath.curveFee(amount);
        assertEq(creator + treasury, total);
        assertLe(total, amount);
        assertEq(total, (amount * 100) / 10_000);
        assertEq(creator, (total * 30) / 100);
        assertEq(treasury, total - creator);
        assertLe(total * 10_000, amount * 100);
    }

    function testFuzz_v4SplitSums(uint256 amount) public pure {
        amount = bound(amount, 0, type(uint128).max);
        (uint256 creator, uint256 treasury, uint256 compound) = FusedFeeMath.v4Split(amount);
        assertEq(creator + treasury + compound, amount);
        assertEq(creator, (amount * 7_000) / 10_000);
        assertEq(treasury, (amount * 1_000) / 10_000);
        assertEq(compound, amount - creator - treasury);
    }

    function test_dustGoesToTreasuryAndCompound() public pure {
        (uint256 total, uint256 creator, uint256 treasury) = FusedFeeMath.curveFee(101);
        assertEq(total, 1);
        assertEq(creator, 0);
        assertEq(treasury, 1);

        (uint256 c, uint256 t, uint256 k) = FusedFeeMath.v4Split(3);
        assertEq(c, 2);
        assertEq(t, 0);
        assertEq(k, 1);
        assertEq(c + t + k, 3);
    }
}
