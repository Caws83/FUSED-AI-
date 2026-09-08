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

import {LaunchFactory} from "src/LaunchFactory.sol";
import {LaunchLocker} from "src/LaunchLocker.sol";
import {LaunchToken} from "src/LaunchToken.sol";

/// Phase 3: local stack + launch must keep OpenLaunch locker invariants.
contract LocalLaunchPipelineTest is Test, DeployPermit2 {
    IPoolManager manager;
    IAllowanceTransfer permit2;
    PositionManager posm;
    LaunchFactory factory;
    LaunchLocker locker;
    address creator = makeAddr("creator");

    function setUp() public {
        manager = IPoolManager(address(new PoolManager(address(this))));
        permit2 = IAllowanceTransfer(deployPermit2());
        posm = new PositionManager(manager, permit2, 50_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        factory = new LaunchFactory(manager, posm, permit2);
        locker = factory.locker();
    }

    function _launch() internal returns (address token, uint256 tokenId) {
        LaunchLocker.Recipient[] memory none = new LaunchLocker.Recipient[](0);
        LaunchFactory.LaunchParams memory p = LaunchFactory.LaunchParams({
            name: "Pipeline",
            symbol: "PIPE",
            metadataURI: "local://pipeline",
            quote: address(0),
            supply: 0,
            startTick: 184_200,
            lpFee: 10_000,
            salt: bytes32("pipeline"),
            recipients: none
        });
        vm.prank(creator);
        return factory.launch(p);
    }

    function test_localLaunchEmitsAndLocksLiquidity() public {
        (address token, uint256 tokenId) = _launch();
        assertTrue(token.code.length > 0, "token bytecode");
        assertEq(posm.ownerOf(tokenId), address(locker), "locker owns NFT");
        assertGt(posm.getPositionLiquidity(tokenId), 0, "liquidity exists");
        assertEq(LaunchToken(token).balanceOf(address(factory)), 0, "factory does not keep supply");
        assertEq(LaunchToken(token).launcher(), creator);
        assertEq(LaunchToken(token).factory(), address(factory));
        assertEq(factory.launchCount(), 1);
        (uint256 id, address launcher,,,) = factory.infoOf(token);
        assertEq(id, tokenId);
        assertEq(launcher, creator);
        assertEq(locker.tokenIdOf(token), tokenId);
    }

    function test_creatorCannotTakePositionNft() public {
        (, uint256 tokenId) = _launch();
        vm.prank(creator);
        vm.expectRevert();
        posm.transferFrom(address(locker), creator, tokenId);
        vm.prank(creator);
        vm.expectRevert();
        posm.approve(creator, tokenId);
        assertEq(posm.ownerOf(tokenId), address(locker));
    }

    function test_factoryAndLockerHaveNoOwner() public {
        (address token,) = _launch();
        (bool factoryOwner,) = address(factory).staticcall(abi.encodeWithSignature("owner()"));
        (bool lockerOwner,) = address(locker).staticcall(abi.encodeWithSignature("owner()"));
        (bool tokenOwner,) = token.staticcall(abi.encodeWithSignature("owner()"));
        assertFalse(factoryOwner);
        assertFalse(lockerOwner);
        assertFalse(tokenOwner);
    }
}
