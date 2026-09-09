// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FusedCurveMath} from "src/fused/FusedCurveMath.sol";

contract CurveMathHarness {
    function buyOut(uint256 x, uint256 y, uint256 inv, uint256 dx) external pure returns (uint256, uint256, uint256) {
        return FusedCurveMath.buyOut(x, y, inv, dx);
    }

    function sellOut(uint256 x, uint256 y, uint256 realQ, uint256 dy) external pure returns (uint256, uint256, uint256) {
        return FusedCurveMath.sellOut(x, y, realQ, dy);
    }
}

contract FusedCurveMathTest is Test {
    uint256 constant X0 = 0.05 ether;
    uint256 constant Y0 = 1_000_000_000 ether;
    CurveMathHarness harness;

    function setUp() public {
        harness = new CurveMathHarness();
    }

    function test_buyThenSellRoundsInFavorOfPool() public view {
        uint256 dx = 0.01 ether;
        (uint256 tokensOut, uint256 x1, uint256 y1) = harness.buyOut(X0, Y0, Y0, dx);
        assertGt(tokensOut, 0);
        assertEq(x1, X0 + dx);
        assertEq(y1 + tokensOut, Y0);
        assertGe(x1 * y1, X0 * Y0);

        (uint256 quoteOut, uint256 x2, uint256 y2) = harness.sellOut(x1, y1, dx, tokensOut);
        assertLe(quoteOut, dx);
        assertEq(y2, y1 + tokensOut);
        assertEq(x2 + quoteOut, x1);
    }

    function test_zeroBuyReverts() public {
        vm.expectRevert(FusedCurveMath.ZeroAmount.selector);
        harness.buyOut(X0, Y0, Y0, 0);
    }

    function test_inventoryGuard() public {
        vm.expectRevert(FusedCurveMath.InsufficientInventory.selector);
        harness.buyOut(X0, Y0, 1, 0.01 ether);
    }

    function test_progressCapsAtTenThousand() public pure {
        assertEq(FusedCurveMath.progressBps(0, 0.1 ether), 0);
        assertEq(FusedCurveMath.progressBps(0.05 ether, 0.1 ether), 5_000);
        assertEq(FusedCurveMath.progressBps(1 ether, 0.1 ether), 10_000);
    }

    function testFuzz_buyOutputBounded(uint96 quoteIn) public view {
        quoteIn = uint96(bound(quoteIn, 1, 10 ether));
        (uint256 tokensOut, uint256 x1, uint256 y1) = harness.buyOut(X0, Y0, Y0, quoteIn);
        assertLe(tokensOut, Y0);
        assertGe(x1 * y1, X0 * Y0);
    }

    function testFuzz_sellNeverExceedsRealQuote(uint96 tokenIn) public view {
        (uint256 bought,, uint256 y1) = harness.buyOut(X0, Y0, Y0, 0.02 ether);
        tokenIn = uint96(bound(tokenIn, bought / 1e6 + 1, bought));
        (uint256 quoteOut,,) = harness.sellOut(X0 + 0.02 ether, y1, 0.02 ether, tokenIn);
        assertLe(quoteOut, 0.02 ether);
    }
}
