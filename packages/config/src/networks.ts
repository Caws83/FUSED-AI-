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

export function deploymentFileName(chainId: number): string {
  if (chainId === LOCAL_CHAIN_ID) return `local-${LOCAL_CHAIN_ID}.json`;
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) return "robinhood-testnet-46630.json";
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return "robinhood-4663.json";
  return `chain-${chainId}.json`;
}
