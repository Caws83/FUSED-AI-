export const LAUNCH_FACTORY_ABI = [
  {
    type: "function",
    name: "launch",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "quote", type: "address" },
          { name: "supply", type: "uint256" },
          { name: "startTick", type: "int24" },
          { name: "lpFee", type: "uint24" },
          { name: "salt", type: "bytes32" },
          {
            name: "recipients",
            type: "tuple[]",
            components: [
              { name: "payout", type: "address" },
              { name: "bps", type: "uint16" },
            ],
          },
        ],
      },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "infoOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "launcher", type: "address" },
      { name: "quote", type: "address" },
      { name: "startTick", type: "int24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
  { type: "function", name: "launchCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "locker", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  {
    type: "event",
    name: "Launched",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "launcher", type: "address", indexed: true },
      { name: "quote", type: "address", indexed: false },
      { name: "poolId", type: "bytes32", indexed: false },
      { name: "startTick", type: "int24", indexed: false },
      { name: "lpFee", type: "uint24", indexed: false },
      { name: "supply", type: "uint256", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
  { type: "error", name: "BadSupply", inputs: [] },
  { type: "error", name: "BadFee", inputs: [] },
  { type: "error", name: "BadTick", inputs: [] },
  { type: "error", name: "NoLiquidity", inputs: [] },
  { type: "error", name: "SaltUsed", inputs: [] },
  { type: "error", name: "QuoteOrdering", inputs: [] },
  { type: "error", name: "NoSaltFound", inputs: [] },
] as const;

export const LAUNCHED_EVENT = LAUNCH_FACTORY_ABI.find((item) => item.type === "event" && item.name === "Launched");

export const LAUNCH_LOCKER_ABI = [
  { type: "function", name: "tokenIdOf", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

export const LAUNCH_TOKEN_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "launcher", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "metadataURI", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export const POSITION_MANAGER_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "getPositionLiquidity", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint128" }] },
] as const;

export const LAUNCH_ERROR_MESSAGES: Record<string, string> = {
  BadSupply: "Supply is not allowed.",
  BadFee: "Fee is outside the allowed range.",
  BadTick: "Start tick is invalid.",
  NoLiquidity: "The position would have no liquidity.",
  SaltUsed: "That launch salt is already used. Try again.",
  QuoteOrdering: "Token address must sort above the quote asset.",
  NoSaltFound: "Could not find a salt that sorts above the quote.",
};

export type LaunchParams = {
  name: string;
  symbol: string;
  metadataURI: string;
  quote: `0x${string}`;
  supply: bigint;
  startTick: number;
  lpFee: number;
  salt: `0x${string}`;
  recipients: readonly { payout: `0x${string}`; bps: number }[];
};

export const DEFAULT_START_TICK = 184_200;
export const DEFAULT_LP_FEE = 10_000;
export const NATIVE_QUOTE = "0x0000000000000000000000000000000000000000" as const;

export function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function validateLaunchForm(input: { name: string; symbol: string; metadataURI: string }): string | null {
  const name = input.name.trim();
  const symbol = input.symbol.trim();
  if (name.length < 1 || name.length > 32) return "Name must be 1–32 characters.";
  if (!/^[A-Za-z0-9]{1,11}$/.test(symbol)) return "Ticker must be 1–11 letters or numbers.";
  if (input.metadataURI.length > 512) return "Description is too long.";
  return null;
}

export function toLaunchParams(input: {
  name: string;
  symbol: string;
  metadataURI: string;
  creator: `0x${string}`;
  salt?: `0x${string}`;
}): LaunchParams {
  return {
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    metadataURI: input.metadataURI.trim(),
    quote: NATIVE_QUOTE,
    supply: 0n,
    startTick: DEFAULT_START_TICK,
    lpFee: DEFAULT_LP_FEE,
    salt: input.salt ?? randomSalt(),
    recipients: [{ payout: input.creator, bps: 10_000 }],
  };
}
