// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {FusedFactoryV2} from "src/fused/FusedFactoryV2.sol";
import {FusedLocker} from "src/fused/FusedLocker.sol";
import {FusedFeeMath} from "src/fused/FusedFeeMath.sol";

interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IV1Factory {
    function creatorOf(address token) external view returns (address);
    function getMarket(address token)
        external
        view
        returns (
            address creator,
            uint8 state,
            uint256 virtualQuote,
            uint256 virtualToken,
            uint256 realQuote,
            uint256 realToken,
            uint256 totalSupply,
            uint256 circulating,
            uint256 graduationTarget,
            uint256 tokenId,
            uint256 createdAt,
            uint24 lpFee,
            uint256 priceX18,
            uint256 progressBps
        );
}

/// @notice Isolated live smoke against the already-deployed Robinhood testnet V2 factory.
/// Does not deploy contracts. Does not touch v1 routing.
contract SmokeFusedV2Live is Script {
    uint256 internal constant TESTNET_CHAIN_ID = 46630;
    address internal constant V2 = 0x359b3D82d958488eA9177c0F56EB3558ba59a40B;
    address internal constant LOCKER = 0x2De462b0a9A7bB378a8a4E68a352eF30A9250D15;
    address internal constant V1 = 0x42654079a991EE21e2d2f7Eed0A77bf6a0082208;
    address internal constant V1_LOCKER = 0x68000CD8F3AFE93BB87BeEDc9f2daBbf39E0836b;
    address internal constant TREASURY = 0x6F88E279002051ceB09ead378081Df8Fc124AacD;
    address internal constant POSM = 0x58daec3116aae6D93017bAAea7749052E8a04fA7;

    function run() external {
        require(block.chainid == TESTNET_CHAIN_ID, "not robinhood testnet 46630");
        require(block.chainid != 4663, "refuse mainnet");

        string memory step = vm.envOr("SMOKE_STEP", string("create"));
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        FusedFactoryV2 factory = FusedFactoryV2(payable(V2));
        require(address(factory.locker()) == LOCKER, "wrong locker");

        if (_eq(step, "create")) {
            _create(pk, deployer, factory);
            return;
        }

        address token = vm.envAddress("SMOKE_TOKEN");
        if (_eq(step, "buy")) _buy(pk, deployer, factory, token, vm.envUint("SMOKE_BUY_WEI"));
        else if (_eq(step, "sell")) _sell(pk, deployer, factory, token, vm.envUint("SMOKE_SELL_BPS"));
        else if (_eq(step, "claim")) _claim(pk, deployer, factory, token);
        else if (_eq(step, "claimFor")) _claimFor(pk, deployer, factory, token);
        else if (_eq(step, "graduateBuy")) _buy(pk, deployer, factory, token, vm.envUint("SMOKE_BUY_WEI"));
        else if (_eq(step, "graduate")) _graduate(pk, factory, token);
        else if (_eq(step, "v4buy")) _buy(pk, deployer, factory, token, vm.envUint("SMOKE_BUY_WEI"));
        else if (_eq(step, "v4sell")) _sell(pk, deployer, factory, token, vm.envUint("SMOKE_SELL_BPS"));
        else if (_eq(step, "collect")) _collect(pk, factory, token);
        else if (_eq(step, "lockerClaimCreator")) _lockerClaim(pk, deployer, token, deployer);
        else if (_eq(step, "lockerClaimTreasury")) _lockerClaim(pk, deployer, token, TREASURY);
        else if (_eq(step, "snapshot")) _snapshot("manual", factory, token, deployer);
        else revert("unknown SMOKE_STEP");
    }

    function _create(uint256 pk, address deployer, FusedFactoryV2 factory) internal {
        bytes32 salt = keccak256(abi.encode("FV2SMOKE", deployer, block.timestamp, block.number));
        vm.startBroadcast(pk);
        address token = factory.create(
            FusedFactoryV2.CreateParams({
                name: "FUSED V2 Smoke",
                symbol: "FV2SMOKE",
                metadataURI: "smoke://fv2smoke",
                salt: salt,
                minTokensOut: 0,
                deadline: block.timestamp + 600
            })
        );
        vm.stopBroadcast();
        console2.log("createToken", token);
        _assertV2Only(factory, token, deployer);
        _snapshot("after-create", factory, token, deployer);
    }

    function _buy(uint256 pk, address deployer, FusedFactoryV2 factory, address token, uint256 valueWei) internal {
        require(valueWei > 0, "buy value");
        _snapshot("before-buy", factory, token, deployer);
        (uint256 total, uint256 creatorShare, uint256 treasuryShare) = FusedFeeMath.curveFee(valueWei);
        FusedFactoryV2.MarketView memory before = factory.getMarket(token);
        uint256 reservedBefore = factory.reservedFees();
        uint256 creatorBefore = factory.claimable(deployer);
        uint256 treasuryBefore = factory.claimable(TREASURY);
        uint256 factoryEthBefore = address(factory).balance;
        uint8 stateBefore = before.state;

        vm.startBroadcast(pk);
        factory.buy{value: valueWei}(token, 0, block.timestamp + 600);
        vm.stopBroadcast();

        FusedFactoryV2.MarketView memory afterM = factory.getMarket(token);
        console2.log("buyValue", valueWei);
        console2.log("expectedFeeTotal", total);
        console2.log("expectedCreatorShare", creatorShare);
        console2.log("expectedTreasuryShare", treasuryShare);
        console2.log("expectedNet", valueWei - total);
        if (stateBefore == 1 && afterM.state == 1) {
            require(factory.claimable(deployer) == creatorBefore + creatorShare, "creator claimable");
            require(factory.claimable(TREASURY) == treasuryBefore + treasuryShare, "treasury claimable");
            require(factory.reservedFees() == reservedBefore + total, "reservedFees");
            require(afterM.realQuote == before.realQuote + (valueWei - total), "realQuote net only");
            require(address(factory).balance == factoryEthBefore + valueWei, "factory eth should keep fees");
        } else if (stateBefore == 1 && afterM.state == 2) {
            require(factory.reservedFees() == reservedBefore + total, "reserved spent as liquidity");
            require(afterM.tokenId != 0, "no tokenId");
            require(afterM.lpFee == 10_000, "lpFee");
            require(IERC721Owner(POSM).ownerOf(afterM.tokenId) == LOCKER, "locker not nft owner");
            console2.log("autoGraduated", true);
            console2.log("lpTokenId", afterM.tokenId);
            console2.log("reservedAfterGrad", factory.reservedFees());
        }
        _snapshot("after-buy", factory, token, deployer);
    }

    function _sell(uint256 pk, address deployer, FusedFactoryV2 factory, address token, uint256 sellBps) internal {
        require(sellBps > 0 && sellBps <= 10_000, "sell bps");
        uint256 bal = IERC20(token).balanceOf(deployer);
        uint256 tokenIn = (bal * sellBps) / 10_000;
        require(tokenIn > 0, "nothing to sell");
        _snapshot("before-sell", factory, token, deployer);
        FusedFactoryV2.MarketView memory before = factory.getMarket(token);
        uint256 quotedNet;
        if (before.state == 1) {
            (quotedNet,) = factory.quoteSell(token, tokenIn);
        }
        uint256 creatorBefore = factory.claimable(deployer);
        uint256 treasuryBefore = factory.claimable(TREASURY);
        uint256 reservedBefore = factory.reservedFees();
        uint256 deployerEthBefore = deployer.balance;
        uint8 stateBefore = before.state;

        vm.startBroadcast(pk);
        IERC20(token).approve(address(factory), tokenIn);
        uint256 netOut = factory.sell(token, tokenIn, 0, block.timestamp + 600);
        vm.stopBroadcast();

        console2.log("sellTokenIn", tokenIn);
        console2.log("sellNetOut", netOut);
        if (stateBefore == 1) {
            console2.log("quoteSellExpectedNet", quotedNet);
            require(netOut == quotedNet, "sell net mismatch");
            uint256 feeTotal = factory.reservedFees() - reservedBefore;
            uint256 creatorShare = factory.claimable(deployer) - creatorBefore;
            uint256 treasuryShare = factory.claimable(TREASURY) - treasuryBefore;
            console2.log("sellFeeTotal", feeTotal);
            console2.log("sellCreatorShare", creatorShare);
            console2.log("sellTreasuryShare", treasuryShare);
            require(feeTotal == creatorShare + treasuryShare, "sell 30/70 sum");
            require(creatorShare == (feeTotal * 30) / 100, "sell creator 30");
            require(treasuryShare == feeTotal - creatorShare, "sell treasury dust-to-treasury");
            require(factory.getMarket(token).realQuote + (netOut + feeTotal) == before.realQuote, "realQuote gross down");
            require(deployer.balance + 0.01 ether > deployerEthBefore, "sanity");
        }
        _snapshot("after-sell", factory, token, deployer);
    }

    function _claim(uint256 pk, address deployer, FusedFactoryV2 factory, address token) internal {
        uint256 due = factory.claimable(deployer);
        require(due > 0, "nothing to claim");
        uint256 reservedBefore = factory.reservedFees();
        uint256 treasuryClaimableBefore = factory.claimable(TREASURY);
        uint256 treasuryEthBefore = TREASURY.balance;
        uint256 realQuoteBefore = factory.getMarket(token).realQuote;
        uint256 deployerBefore = deployer.balance;
        _snapshot("before-creator-claim", factory, token, deployer);

        vm.startBroadcast(pk);
        uint256 paid = factory.claim();
        vm.stopBroadcast();

        console2.log("creatorClaimed", paid);
        require(paid == due, "claim amount");
        require(factory.claimable(deployer) == 0, "creator claimable leftover");
        require(factory.reservedFees() == reservedBefore - paid, "reserved after claim");
        require(factory.claimable(TREASURY) == treasuryClaimableBefore, "treasury claimable touched");
        require(TREASURY.balance == treasuryEthBefore, "treasury eth touched");
        require(factory.getMarket(token).realQuote == realQuoteBefore, "realQuote touched");
        console2.log("creatorEthBefore", deployerBefore);
        console2.log("creatorEthAfter", deployer.balance);
        _snapshot("after-creator-claim", factory, token, deployer);
    }

    function _claimFor(uint256 pk, address deployer, FusedFactoryV2 factory, address token) internal {
        uint256 due = factory.claimable(TREASURY);
        require(due > 0, "treasury nothing to claim");
        uint256 reservedBefore = factory.reservedFees();
        uint256 creatorClaimableBefore = factory.claimable(deployer);
        uint256 creatorEthBefore = deployer.balance;
        uint256 treasuryEthBefore = TREASURY.balance;
        uint256 realQuoteBefore = factory.getMarket(token).realQuote;
        _snapshot("before-treasury-claimFor", factory, token, deployer);

        vm.startBroadcast(pk);
        uint256 paid = factory.claimFor(TREASURY);
        vm.stopBroadcast();

        console2.log("treasuryClaimed", paid);
        require(paid == due, "claimFor amount");
        require(factory.claimable(TREASURY) == 0, "treasury claimable leftover");
        require(factory.reservedFees() == reservedBefore - paid, "reserved after claimFor");
        require(factory.claimable(deployer) == creatorClaimableBefore, "creator claimable touched");
        require(TREASURY.balance == treasuryEthBefore + paid, "payout not treasury");
        require(factory.getMarket(token).realQuote == realQuoteBefore, "realQuote touched");
        console2.log("callerEthBefore", creatorEthBefore);
        console2.log("callerEthAfter", deployer.balance);
        _snapshot("after-treasury-claimFor", factory, token, deployer);
    }

    function _graduate(uint256 pk, FusedFactoryV2 factory, address token) internal {
        FusedFactoryV2.MarketView memory before = factory.getMarket(token);
        require(before.state == 1, "not curve");
        require(before.realQuote >= before.graduationTarget, "not ready");
        uint256 reservedBefore = factory.reservedFees();
        uint256 factoryEthBefore = address(factory).balance;
        require(reservedBefore > 0, "need outstanding reserved fees");
        require(factoryEthBefore >= before.realQuote + reservedBefore, "insolvent");
        console2.log("preGradRealQuote", before.realQuote);
        console2.log("preGradReserved", reservedBefore);
        console2.log("preGradFactoryEth", factoryEthBefore);
        console2.log("preGradTokenInventory", before.realToken);

        vm.startBroadcast(pk);
        factory.graduate(token);
        vm.stopBroadcast();

        FusedFactoryV2.MarketView memory afterM = factory.getMarket(token);
        require(afterM.state == 2, "not graduated");
        require(afterM.tokenId != 0, "no tokenId");
        require(factory.reservedFees() == reservedBefore, "reserved spent as liquidity");
        require(afterM.realQuote == 0 && afterM.realToken == 0, "curve leftover");
        require(afterM.lpFee == 10_000, "lpFee");
        require(IERC721Owner(POSM).ownerOf(afterM.tokenId) == LOCKER, "locker not nft owner");
        require(FusedLocker(payable(LOCKER)).tokenOf(afterM.tokenId) == token, "locker token");
        require(FusedLocker(payable(LOCKER)).creatorOf(afterM.tokenId) == before.creator, "locker creator");
        require(FusedLocker(payable(LOCKER)).treasuryOf(afterM.tokenId) == TREASURY, "locker treasury");
        require(FusedLocker(payable(LOCKER)).quoteOf(afterM.tokenId) == address(0), "quote not eth");
        console2.log("lpTokenId", afterM.tokenId);
        _snapshot("after-graduate", factory, token, before.creator);

        vm.startBroadcast(pk);
        (bool ok,) = address(factory).call(abi.encodeWithSelector(factory.graduate.selector, token));
        vm.stopBroadcast();
        require(!ok, "second graduate succeeded");
        console2.log("secondGraduateReverted", true);
    }

    function _collect(uint256 pk, FusedFactoryV2 factory, address token) internal {
        uint256 tokenId = factory.getMarket(token).tokenId;
        FusedLocker locker = FusedLocker(payable(LOCKER));
        address creator = locker.creatorOf(tokenId);
        uint256 carryEthBefore = locker.compoundCarry(tokenId, address(0));
        uint256 carryTokBefore = locker.compoundCarry(tokenId, token);
        uint256 creatorEthClaimBefore = locker.claimable(creator, address(0));
        uint256 treasuryEthClaimBefore = locker.claimable(TREASURY, address(0));
        uint256 otherIdCarry = locker.compoundCarry(tokenId + 1, address(0));
        console2.log("collectTokenId", tokenId);
        console2.log("carryEthBefore", carryEthBefore);
        console2.log("carryTokBefore", carryTokBefore);
        console2.log("otherIdCarryBefore", otherIdCarry);

        vm.startBroadcast(pk);
        (uint256 quoteOut, uint256 tokenOut) = locker.collect(tokenId);
        vm.stopBroadcast();

        console2.log("collectedQuote", quoteOut);
        console2.log("collectedToken", tokenOut);
        (uint256 cQ, uint256 tQ, uint256 kQ) = FusedFeeMath.v4Split(quoteOut);
        (uint256 cT, uint256 tT, uint256 kT) = FusedFeeMath.v4Split(tokenOut);
        console2.log("splitCreatorQuote", cQ);
        console2.log("splitTreasuryQuote", tQ);
        console2.log("splitCompoundQuote", kQ);
        console2.log("splitCreatorToken", cT);
        console2.log("splitTreasuryToken", tT);
        console2.log("splitCompoundToken", kT);
        console2.log("carryEthAfter", locker.compoundCarry(tokenId, address(0)));
        console2.log("carryTokAfter", locker.compoundCarry(tokenId, token));
        console2.log("otherIdCarryAfter", locker.compoundCarry(tokenId + 1, address(0)));
        require(locker.compoundCarry(tokenId + 1, address(0)) == otherIdCarry, "carry leaked to other id");
        console2.log("creatorEthClaimableAfter", locker.claimable(creator, address(0)));
        console2.log("treasuryEthClaimableAfter", locker.claimable(TREASURY, address(0)));
        console2.log("creatorEthClaimableDelta", locker.claimable(creator, address(0)) - creatorEthClaimBefore);
        console2.log("treasuryEthClaimableDelta", locker.claimable(TREASURY, address(0)) - treasuryEthClaimBefore);
    }

    function _lockerClaim(uint256 pk, address deployer, address token, address account) internal {
        FusedLocker locker = FusedLocker(payable(LOCKER));
        uint256 due = locker.claimable(account, address(0));
        uint256 dueTok = locker.claimable(account, token);
        console2.log("lockerClaimAccount", account);
        console2.log("lockerClaimEthDue", due);
        console2.log("lockerClaimTokDue", dueTok);
        uint256 ethBefore = account.balance;
        vm.startBroadcast(pk);
        if (due > 0) locker.claimFor(account, address(0));
        if (dueTok > 0) locker.claimFor(account, token);
        vm.stopBroadcast();
        if (due > 0) require(locker.claimable(account, address(0)) == 0, "eth leftover");
        if (account == TREASURY && due > 0) require(TREASURY.balance == ethBefore + due, "treasury payout");
        if (account == deployer && due > 0) require(deployer.balance > ethBefore, "creator payout");
        console2.log("lockerClaimDone", true);
    }

    function _assertV2Only(FusedFactoryV2 factory, address token, address deployer) internal view {
        require(factory.creatorOf(token) == deployer, "v2 creator");
        require(factory.getMarket(token).state == 1, "not curve");
        try IV1Factory(V1).creatorOf(token) returns (address v1c) {
            require(v1c == address(0), "v1 recognized creator");
        } catch {
            console2.log("v1 creatorOf reverted UnknownMarket", true);
        }
        (address v1Creator, uint8 v1State,,,,,,,,,,,,) = _v1Market(token);
        require(v1Creator == address(0) && v1State == 0, "v1 getMarket populated");
        require(V1.code.length > 0 && V1_LOCKER.code.length > 0, "v1 missing");
    }

    function _v1Market(address token)
        internal
        view
        returns (
            address creator,
            uint8 state,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint24,
            uint256,
            uint256
        )
    {
        return IV1Factory(V1).getMarket(token);
    }

    function _snapshot(string memory label, FusedFactoryV2 factory, address token, address deployer) internal view {
        FusedFactoryV2.MarketView memory m = factory.getMarket(token);
        console2.log("snapshot", label);
        console2.log("token", token);
        console2.log("creator", m.creator);
        console2.log("state", m.state);
        console2.log("realQuote", m.realQuote);
        console2.log("realToken", m.realToken);
        console2.log("circulating", m.circulating);
        console2.log("tokenId", m.tokenId);
        console2.log("lpFee", m.lpFee);
        console2.log("graduationTarget", m.graduationTarget);
        console2.log("progressBps", m.progressBps);
        console2.log("reservedFees", factory.reservedFees());
        console2.log("claimableCreator", factory.claimable(deployer));
        console2.log("claimableTreasury", factory.claimable(TREASURY));
        console2.log("factoryEth", address(factory).balance);
        console2.log("deployerEth", deployer.balance);
        console2.log("treasuryEth", TREASURY.balance);
        console2.log("deployerToken", IERC20(token).balanceOf(deployer));
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
