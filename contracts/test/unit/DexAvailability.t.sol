// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {V2Adapter} from "../../src/dex/v2/V2Adapter.sol";
import {V3Adapter} from "../../src/dex/v3/V3Adapter.sol";
import {V4Adapter} from "../../src/dex/v4/V4Adapter.sol";
import {TokenizedAssetRegistry} from "../../src/registry/TokenizedAssetRegistry.sol";

contract DexAvailabilityTest is Test {
    function test_noAdapterIsAvailable() public {
        V2Adapter v2 = new V2Adapter();
        V3Adapter v3 = new V3Adapter();
        V4Adapter v4 = new V4Adapter();
        assertFalse(v2.available());
        assertFalse(v3.available());
        assertFalse(v4.available());
        assertFalse(v2.implemented());
        assertFalse(v3.implemented());
        assertTrue(v4.implemented());
    }

    function test_registryStartsEmpty() public {
        TokenizedAssetRegistry registry = new TokenizedAssetRegistry();
        assertFalse(registry.isAllowlisted(8453, address(0xBEEF)));
    }
}
