/** Public chain metadata. No secrets. 4663 is mainnet; 46630 is testnet. Arc is chain #2. */

export const LOCAL_CHAIN_ID = 31337;
export const ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630;
export const ARC_MAINNET_CHAIN_ID = 5042;
export const ARC_TESTNET_CHAIN_ID = 5042002;

export type NativeCurrency = { name: string; symbol: string; decimals: number };

export const NATIVE_ETH: NativeCurrency = { name: "Ether", symbol: "ETH", decimals: 18 };
export const NATIVE_USDC: NativeCurrency = { name: "USD Coin", symbol: "USDC", decimals: 18 };

export const ROBINHOOD_MAINNET = {
  network: "robinhood" as const,
  chainId: ROBINHOOD_MAINNET_CHAIN_ID,
  name: "Robinhood Mainnet",
  nativeCurrency: NATIVE_ETH,
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://explorer.chain.robinhood.com",
};

export const ROBINHOOD_TESTNET = {
  network: "robinhood-testnet" as const,
  chainId: ROBINHOOD_TESTNET_CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: NATIVE_ETH,
  rpcUrl: "https://rpc.testnet.chain.robinhood.com",
  explorer: "https://explorer.testnet.chain.robinhood.com",
};

export const ARC_TESTNET = {
  network: "arc-testnet" as const,
  chainId: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: NATIVE_USDC,
  rpcUrl: "https://rpc.testnet.arc.io",
  explorer: "https://testnet.arcscan.app",
  canonicalUsdc: "0x3600000000000000000000000000000000000000",
  usdcErc20Decimals: 6,
};

export const ARC_MAINNET = {
  network: "arc" as const,
  chainId: ARC_MAINNET_CHAIN_ID,
  name: "Arc",
  nativeCurrency: NATIVE_USDC,
  rpcUrl: "https://rpc.arc-scan.org",
  explorer: "https://arc-scan.org",
  canonicalUsdc: "0x3600000000000000000000000000000000000000",
  usdcErc20Decimals: 6,
};

/** Official Uniswap v4 on Arc mainnet 5042. Not present on Arc testnet 5042002. Do not use on 46630. */
export const ARC_MAINNET_V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x6049c9a0e26405c0985f9e3685c87d0ae917f82b",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
  universalRouter: "0x4fca4a51ab4f23a7447b3284fbd7d73289a89fb1",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

/**
 * Uniswap v4 addresses with non-empty bytecode on chain 46630
 * (eth_getCode, official public RPC, 2026-09-11). Same CREATE addresses as
 * Robinhood mainnet Uniswap docs — still verified on testnet before use.
 * Not Fused AI contracts.
 */
export const ROBINHOOD_MAINNET_V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
} as const;

export const ROBINHOOD_TESTNET_V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
} as const;

export const ROBINHOOD_MAINNET_CURVE = {
  network: "robinhood" as const,
  chainId: ROBINHOOD_MAINNET_CHAIN_ID,
  virtualQuoteWei: "1680000000000000000",
  virtualToken: "1000000000000000000000000000",
  graduationTargetWei: "4200000000000000000",
  graduationTargetEth: "4.2",
  feeBps: 100,
  lpFee: 10_000,
  note: "Robinhood mainnet 4663. Pons-like 1.68/4.2 ETH. Audited V2 1% 30/70 and V4 70/10/20.",
};

/** TESTNET ONLY. Not a local fallback and not a mainnet $50k conversion. */
export const ROBINHOOD_TESTNET_CURVE = {
  network: "robinhood-testnet" as const,
  chainId: ROBINHOOD_TESTNET_CHAIN_ID,
  virtualQuoteWei: "50000000000000000",
  virtualToken: "1000000000000000000000000000",
  graduationTargetWei: "10000000000000000",
  graduationTargetEth: "0.01",
  feeBps: 0,
  lpFee: 10_000,
  note: "TESTNET ONLY. Explicit low target for faucet ETH. Not 0.1 local. Not $50,000 mainnet.",
};

export const ARC_TESTNET_CURVE = {
  network: "arc-testnet" as const,
  chainId: ARC_TESTNET_CHAIN_ID,
  virtualQuoteWei: "50000000000000000",
  virtualToken: "1000000000000000000000000000",
  graduationTargetWei: "10000000000000000",
  feeBps: 100,
  lpFee: 10_000,
  note: "TESTNET ONLY. Native 18-dec USDC curve. 1% fee. Tiny graduation target. No Uniswap on 5042002.",
};

/** Populated after Arc testnet deploy. Never a Robinhood address. */
export const ARC_TESTNET_LAUNCH = {
  version: "arc" as const,
  factory: "0x98Cab6d3FaE4783A0D0cB13701d0e9772d6833E5",
  locker: "0xcb6eA43c418e91F54c4B1748C6626493bFdB9be2",
  deployBlock: 62246396,
};

export function nativeCurrencyFor(chainId: number | null | undefined): NativeCurrency {
  if (chainId === ARC_TESTNET_CHAIN_ID || chainId === ARC_MAINNET_CHAIN_ID) return NATIVE_USDC;
  return NATIVE_ETH;
}

export function explorerBaseFor(chainId: number | null | undefined): string | null {
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return ROBINHOOD_TESTNET.explorer;
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return ROBINHOOD_MAINNET.explorer;
  if (chainId === ARC_TESTNET_CHAIN_ID) return ARC_TESTNET.explorer;
  if (chainId === ARC_MAINNET_CHAIN_ID) return ARC_MAINNET.explorer;
  return null;
}

export function chainLabelFor(chainId: number | null | undefined): string | undefined {
  if (!chainId) return undefined;
  if (chainId === LOCAL_CHAIN_ID) return "Fused Local";
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return "Robinhood Testnet";
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return ROBINHOOD_MAINNET.name;
  if (chainId === ARC_TESTNET_CHAIN_ID) return "Arc Testnet";
  if (chainId === ARC_MAINNET_CHAIN_ID) return "Arc";
  return `Chain ${chainId}`;
}

export type ChainLaunchContracts = {
  chainId: number;
  factory: string | null;
  locker: string | null;
  deployed: boolean;
};

/**
 * Wallet chainId → contracts. No cross-chain fallback.
 * Unsupported chain returns null (fail closed).
 */
export function launchContractsForChain(chainId: number | null | undefined): ChainLaunchContracts | null {
  if (!chainId) return null;
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) {
    return {
      chainId,
      factory: ROBINHOOD_MAINNET_LAUNCH_V2.factory,
      locker: ROBINHOOD_MAINNET_LAUNCH_V2.locker,
      deployed: true,
    };
  }
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    return {
      chainId,
      factory: ROBINHOOD_TESTNET_LAUNCH_V2.factory,
      locker: ROBINHOOD_TESTNET_LAUNCH_V2.locker,
      deployed: true,
    };
  }
  if (chainId === ARC_TESTNET_CHAIN_ID) {
    return {
      chainId,
      factory: ARC_TESTNET_LAUNCH.factory,
      locker: ARC_TESTNET_LAUNCH.locker,
      deployed: Boolean(ARC_TESTNET_LAUNCH.factory && ARC_TESTNET_LAUNCH.locker),
    };
  }
  if (chainId === ARC_MAINNET_CHAIN_ID) {
    return { chainId, factory: null, locker: null, deployed: false };
  }
  return null;
}

/** Header Network dropdown. Production Robinhood is Mainnet 4663. Arc testnet stays. */
export const WALLET_SELECTOR_CHAIN_IDS = [ROBINHOOD_MAINNET_CHAIN_ID, ARC_TESTNET_CHAIN_ID] as const;

export function isWalletSelectorChain(chainId: number | null | undefined): boolean {
  return chainId === ROBINHOOD_MAINNET_CHAIN_ID || chainId === ARC_TESTNET_CHAIN_ID;
}

/** Boards list the selector chains. Historical 46630 rows stay in Postgres with their own chain_id. */
export const INDEXED_BOARD_CHAIN_IDS = WALLET_SELECTOR_CHAIN_IDS;

export const KNOWN_FUSED_CHAIN_IDS = [
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID,
  ARC_MAINNET_CHAIN_ID,
] as const;

export function isKnownFusedChain(chainId: number | null | undefined): boolean {
  return (
    chainId === ROBINHOOD_MAINNET_CHAIN_ID ||
    chainId === ROBINHOOD_TESTNET_CHAIN_ID ||
    chainId === ARC_TESTNET_CHAIN_ID ||
    chainId === ARC_MAINNET_CHAIN_ID
  );
}

export function parseSupportedChainId(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || !isKnownFusedChain(n)) return null;
  return n;
}

export function rpcUrlForChain(chainId: number | null | undefined): string | null {
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return ROBINHOOD_MAINNET.rpcUrl;
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return ROBINHOOD_TESTNET.rpcUrl;
  if (chainId === ARC_TESTNET_CHAIN_ID) return ARC_TESTNET.rpcUrl;
  if (chainId === ARC_MAINNET_CHAIN_ID) return ARC_MAINNET.rpcUrl;
  return null;
}

export type WalletLaunchContracts = {
  chainId: number;
  factory: string;
  locker: string | null;
};

/**
 * New launches only. Requires a deployed mapping for the wallet chain.
 * Unsupported, disconnected, or undeployed → null (fail closed). No cross-chain fallback.
 */
export function newLaunchForWallet(chainId: number | null | undefined): WalletLaunchContracts | null {
  if (!isWalletSelectorChain(chainId)) return null;
  const row = launchContractsForChain(chainId);
  if (!row?.deployed || !row.factory) return null;
  return { chainId: row.chainId, factory: row.factory, locker: row.locker };
}

/** Immutable V2 treasury. Permissionless claimFor; no public UI. */
export const FUSED_TREASURY = "0x6F88E279002051ceB09ead378081Df8Fc124AacD";

/** Legacy FusedFactory on Robinhood testnet. Do not use for new launches. */
export const ROBINHOOD_TESTNET_LAUNCH_V1 = {
  version: "v1" as const,
  factory: "0x42654079a991EE21e2d2f7Eed0A77bf6a0082208",
  locker: "0x68000CD8F3AFE93BB87BeEDc9f2daBbf39E0836b",
  deployBlock: 117433209,
};

/** Default FusedFactoryV2 on Robinhood testnet. */
export const ROBINHOOD_TESTNET_LAUNCH_V2 = {
  version: "v2" as const,
  factory: "0x359b3D82d958488eA9177c0F56EB3558ba59a40B",
  locker: "0x2De462b0a9A7bB378a8a4E68a352eF30A9250D15",
  deployBlock: 119313128,
};

/** FusedFactoryV2 on Robinhood Mainnet 4663. Never a testnet address. */
export const ROBINHOOD_MAINNET_LAUNCH_V2 = {
  version: "v2" as const,
  factory: "0x6ab51C6573b1C23e04b91b1DD758Eab011972fF8",
  locker: "0xE1421e5fa0203A9C886446dFdaDf4078d1eA2827",
  deployBlock: 64595202,
};

export function deploymentFileName(chainId: number): string {
  if (chainId === LOCAL_CHAIN_ID) return `local-${LOCAL_CHAIN_ID}.json`;
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return "robinhood-testnet-46630.json";
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return "robinhood-4663.json";
  if (chainId === ARC_TESTNET_CHAIN_ID) return "arc-testnet-5042002.json";
  if (chainId === ARC_MAINNET_CHAIN_ID) return "arc-5042.json";
  return `chain-${chainId}.json`;
}

/** V2 overlay. Testnet keeps a separate V1 file; mainnet 4663 is V2-only. */
export function v2DeploymentFileName(chainId: number): string | null {
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return "robinhood-testnet-46630-v2.json";
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return "robinhood-mainnet-4663-v2.json";
  return null;
}
