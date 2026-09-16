import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLaunchRouting,
  tradeFactoryForLaunch,
  indexedLaunchFactories,
  launchVersionOf,
} from "../src/launch.ts";
import { ROBINHOOD_MAINNET_LAUNCH_V2, ROBINHOOD_TESTNET_LAUNCH_V1, ROBINHOOD_TESTNET_LAUNCH_V2, ARC_TESTNET_LAUNCH } from "../src/networks.ts";

test("new launches default to v2 when both generations are configured", () => {
  const routing = parseLaunchRouting({
    chainId: 46630,
    defaultFactory: ROBINHOOD_TESTNET_LAUNCH_V2.factory,
    defaultLocker: ROBINHOOD_TESTNET_LAUNCH_V2.locker,
    defaultVersionRaw: "v2",
    v1Factory: ROBINHOOD_TESTNET_LAUNCH_V1.factory,
    v1Locker: ROBINHOOD_TESTNET_LAUNCH_V1.locker,
    v1DeployBlock: ROBINHOOD_TESTNET_LAUNCH_V1.deployBlock,
    v2Factory: ROBINHOOD_TESTNET_LAUNCH_V2.factory,
    v2Locker: ROBINHOOD_TESTNET_LAUNCH_V2.locker,
    v2DeployBlock: ROBINHOOD_TESTNET_LAUNCH_V2.deployBlock,
  });
  assert.equal(routing.defaultVersion, "v2");
  assert.equal(routing.v2?.factory, ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.equal(routing.v1?.factory, ROBINHOOD_TESTNET_LAUNCH_V1.factory);
  const factories = indexedLaunchFactories(routing);
  assert.equal(factories.length, 2);
  assert.equal(factories[0]?.version, "v1");
  assert.equal(factories[1]?.version, "v2");
});

test("trade routing uses the token factory, not the current default", () => {
  const routing = parseLaunchRouting({
    chainId: 46630,
    defaultFactory: ROBINHOOD_TESTNET_LAUNCH_V2.factory,
    defaultLocker: ROBINHOOD_TESTNET_LAUNCH_V2.locker,
    defaultVersionRaw: "v2",
    v1Factory: ROBINHOOD_TESTNET_LAUNCH_V1.factory,
    v1Locker: ROBINHOOD_TESTNET_LAUNCH_V1.locker,
    v1DeployBlock: ROBINHOOD_TESTNET_LAUNCH_V1.deployBlock,
    v2Factory: ROBINHOOD_TESTNET_LAUNCH_V2.factory,
    v2Locker: ROBINHOOD_TESTNET_LAUNCH_V2.locker,
    v2DeployBlock: ROBINHOOD_TESTNET_LAUNCH_V2.deployBlock,
  });
  assert.equal(tradeFactoryForLaunch(ROBINHOOD_TESTNET_LAUNCH_V1.factory, routing), ROBINHOOD_TESTNET_LAUNCH_V1.factory);
  assert.equal(tradeFactoryForLaunch(ROBINHOOD_TESTNET_LAUNCH_V2.factory, routing), ROBINHOOD_TESTNET_LAUNCH_V2.factory);
  assert.equal(tradeFactoryForLaunch("0x0000000000000000000000000000000000000001", routing), null);
  assert.equal(tradeFactoryForLaunch(null, routing), null);
  assert.equal(launchVersionOf(ROBINHOOD_TESTNET_LAUNCH_V1.factory, routing), "v1");
  assert.equal(launchVersionOf(ROBINHOOD_TESTNET_LAUNCH_V2.factory, routing), "v2");
});

test("mainnet 4663 never picks up a testnet factory", () => {
  const routing = parseLaunchRouting({
    chainId: 4663,
    defaultFactory: ROBINHOOD_TESTNET_LAUNCH_V1.factory,
    defaultLocker: ROBINHOOD_TESTNET_LAUNCH_V1.locker,
    defaultVersionRaw: "v2",
    v1Factory: ROBINHOOD_TESTNET_LAUNCH_V1.factory,
    v1Locker: ROBINHOOD_TESTNET_LAUNCH_V1.locker,
    v1DeployBlock: 1,
    v2Factory: ROBINHOOD_TESTNET_LAUNCH_V2.factory,
    v2Locker: ROBINHOOD_TESTNET_LAUNCH_V2.locker,
    v2DeployBlock: 2,
  });
  assert.equal(routing.v2, null);
  assert.equal(routing.v1, null);
});

test("mainnet 4663 defaults new launches to the deployed V2 factory", () => {
  const routing = parseLaunchRouting({
    chainId: 4663,
    defaultFactory: ROBINHOOD_MAINNET_LAUNCH_V2.factory,
    defaultLocker: ROBINHOOD_MAINNET_LAUNCH_V2.locker,
    defaultVersionRaw: "v2",
    v1Factory: null,
    v1Locker: null,
    v1DeployBlock: null,
    v2Factory: ROBINHOOD_MAINNET_LAUNCH_V2.factory,
    v2Locker: ROBINHOOD_MAINNET_LAUNCH_V2.locker,
    v2DeployBlock: ROBINHOOD_MAINNET_LAUNCH_V2.deployBlock,
  });
  assert.equal(routing.defaultVersion, "v2");
  assert.equal(routing.v2?.factory, ROBINHOOD_MAINNET_LAUNCH_V2.factory);
  assert.equal(routing.v2?.deployBlock, 64595202);
  assert.equal(routing.v1, null);
});

test("Arc factory uses LAUNCH_DEPLOY_BLOCK as its indexer start", () => {
  const routing = parseLaunchRouting({
    chainId: 5042002,
    defaultFactory: ARC_TESTNET_LAUNCH.factory,
    defaultLocker: ARC_TESTNET_LAUNCH.locker,
    defaultVersionRaw: null,
    v1Factory: null,
    v1Locker: null,
    v1DeployBlock: ARC_TESTNET_LAUNCH.deployBlock,
    v2Factory: null,
    v2Locker: null,
    v2DeployBlock: null,
  });
  assert.equal(routing.defaultVersion, "v1");
  assert.equal(routing.v1?.factory, ARC_TESTNET_LAUNCH.factory);
  assert.equal(routing.v1?.deployBlock, 62246396);
  assert.equal(routing.v2, null);
  assert.equal(indexedLaunchFactories(routing).length, 1);
});
