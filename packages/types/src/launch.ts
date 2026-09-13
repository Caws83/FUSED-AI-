export type HexAddress = `0x${string}`;

export type LaunchRecipient = {
  payout: HexAddress;
  bps: number;
};

export type LaunchIntent = {
  name: string;
  symbol: string;
  metadataURI: string;
  quote: HexAddress;
  supply: bigint;
  startTick: number;
  lpFee: number;
  salt: `0x${string}`;
  recipients: readonly LaunchRecipient[];
  sourcePostUrl: string | null;
};

export type LaunchReceipt = {
  chainId: number;
  txHash: `0x${string}`;
  token: HexAddress;
  lockerTokenId: bigint;
  launcher: HexAddress;
  blockNumber: bigint;
};

export type IndexedLaunch = {
  chainId: number;
  token: HexAddress;
  name: string;
  symbol: string;
  launcher: HexAddress;
  quote: HexAddress;
  poolId: `0x${string}` | null;
  tokenId: string;
  startTick: number | null;
  lpFee: number | null;
  supply: string | null;
  metadataURI: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
  createdAt: string | null;
  factory: HexAddress | null;
  locker: HexAddress | null;
  dexVersion: string;
  imageId: string | null;
  imageUrl: string | null;
  appDescription: string | null;
  sourcePlatform: string | null;
  sourcePostId: string | null;
  sourcePostUrl: string | null;
  sourceAuthor: string | null;
  sourceExcerpt: string | null;
  lifecycleState: string;
  realQuote: string | null;
  graduationTarget: string | null;
  circulating: string | null;
  priceX18: string | null;
  volumeQuote: string | null;
  holderCount: number | null;
};
