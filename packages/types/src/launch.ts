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
