import type { HexAddress } from "./launch.ts";

/**
 * Tokenized assets are identified by chain + contract, never by ticker alone.
 */
export type TokenizedAsset = {
  chainId: number;
  contractAddress: HexAddress;
  issuer: string;
  symbol: string;
  name: string;
  decimals: number;
  oracle: {
    kind: "chainlink" | "issuer-api" | "uniswap-twap" | "none";
    feedAddress?: HexAddress;
    feedUrl?: string;
    maxAgeSeconds: number;
  };
  enabled: boolean;
  jurisdictionsRestricted: readonly string[];
  sourceRegistry: string;
  verifiedAt: string;
};

export type RewardDestination =
  | "creator"
  | "holder"
  | "referral"
  | "buyback"
  | "community";

export type RewardRoute = {
  destination: RewardDestination;
  asset: TokenizedAsset;
  bps: number;
};
