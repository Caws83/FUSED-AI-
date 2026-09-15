/** Public chain metadata. No secrets. 4663 is mainnet; 46630 is testnet. */

export const LOCAL_CHAIN_ID = 31337;
export const ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630;

export const ROBINHOOD_TESTNET = {
  network: "robinhood-testnet" as const,
  chainId: ROBINHOOD_TESTNET_CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrl: "https://rpc.testnet.chain.robinhood.com",
  explorer: "https://explorer.testnet.chain.robinhood.com",
};

/**
 * Uniswap v4 addresses with non-empty bytecode on chain 46630
 * (eth_getCode, official public RPC, 2026-09-11). Same CREATE addresses as
 * Robinhood mainnet Uniswap docs — still verified on testnet before use.
 * Not Fused AI contracts.
 */
export const ROBINHOOD_TESTNET_V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
} as const;

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

export function chainLabelFor(chainId: number | null | undefined): string | undefined {
  if (!chainId) return undefined;
  if (chainId === LOCAL_CHAIN_ID) return "Fused Local";
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return "Robinhood Testnet";
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return "Robinhood Chain";
  return `Chain ${chainId}`;
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

export function deploymentFileName(chainId: number): string {
  if (chainId === LOCAL_CHAIN_ID) return `local-${LOCAL_CHAIN_ID}.json`;
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return "robinhood-testnet-46630.json";
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return "robinhood-4663.json";
  return `chain-${chainId}.json`;
}

/** V2 overlay only. Never used for mainnet 4663. */
export function v2DeploymentFileName(chainId: number): string | null {
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return "robinhood-testnet-46630-v2.json";
  return null;
}
