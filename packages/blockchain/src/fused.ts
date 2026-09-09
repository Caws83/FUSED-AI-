export const FUSED_FACTORY_ABI = [
  {
    type: "function",
    name: "create",
    stateMutability: "payable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "salt", type: "bytes32" },
          { name: "minTokensOut", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "minTokensOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "tokensOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenIn", type: "uint256" },
      { name: "minQuoteOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "quoteOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "graduate",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        name: "v",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "state", type: "uint8" },
          { name: "virtualQuote", type: "uint256" },
          { name: "virtualToken", type: "uint256" },
          { name: "realQuote", type: "uint256" },
          { name: "realToken", type: "uint256" },
          { name: "totalSupply", type: "uint256" },
          { name: "circulating", type: "uint256" },
          { name: "graduationTarget", type: "uint256" },
          { name: "tokenId", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "lpFee", type: "uint24" },
          { name: "priceX18", type: "uint256" },
          { name: "progressBps", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "quoteBuy",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "quoteIn", type: "uint256" },
    ],
    outputs: [
      { name: "tokensOut", type: "uint256" },
      { name: "newPriceX18", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "quoteSell",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenIn", type: "uint256" },
    ],
    outputs: [
      { name: "quoteOut", type: "uint256" },
      { name: "newPriceX18", type: "uint256" },
    ],
  },
  { type: "function", name: "locker", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint16" }] },
  { type: "function", name: "graduationTarget", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "STATE_CURVE", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "STATE_GRADUATED", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  {
    type: "event",
    name: "Created",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "supply", type: "uint256", indexed: false },
      { name: "virtualQuote", type: "uint256", indexed: false },
      { name: "virtualToken", type: "uint256", indexed: false },
      { name: "graduationTarget", type: "uint256", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Trade",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "isBuy", type: "bool", indexed: false },
      { name: "quoteAmount", type: "uint256", indexed: false },
      { name: "tokenAmount", type: "uint256", indexed: false },
      { name: "priceX18", type: "uint256", indexed: false },
      { name: "circulating", type: "uint256", indexed: false },
      { name: "realQuote", type: "uint256", indexed: false },
      { name: "venue", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Graduated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "poolId", type: "bytes32", indexed: false },
      { name: "quoteLiquidity", type: "uint256", indexed: false },
      { name: "tokenLiquidity", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "UnknownMarket", inputs: [] },
  { type: "error", name: "NotCurve", inputs: [] },
  { type: "error", name: "NotGraduated", inputs: [] },
  { type: "error", name: "AlreadyGraduated", inputs: [] },
  { type: "error", name: "NotReadyToGraduate", inputs: [] },
  { type: "error", name: "DeadlineExpired", inputs: [] },
  { type: "error", name: "Slippage", inputs: [] },
  { type: "error", name: "BadFee", inputs: [] },
  { type: "error", name: "BadCurve", inputs: [] },
  { type: "error", name: "SaltUsed", inputs: [] },
  { type: "error", name: "ZeroValue", inputs: [] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export const FUSED_ERROR_MESSAGES: Record<string, string> = {
  Slippage: "Price moved. Increase slippage or try a smaller size.",
  DeadlineExpired: "The transaction deadline passed. Try again.",
  ZeroValue: "Enter an amount greater than zero.",
  NotCurve: "This token is no longer on the bonding curve.",
  NotGraduated: "This token has not graduated yet.",
  NotReadyToGraduate: "Graduation target has not been reached.",
  SaltUsed: "That launch salt is already used. Try again.",
  UnknownMarket: "Unknown token.",
};

export function toCreateParams(input: {
  name: string;
  symbol: string;
  metadataURI: string;
  salt?: `0x${string}`;
  minTokensOut?: bigint;
  deadlineSeconds?: number;
}) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const salt =
    input.salt ??
    (`0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`);
  return {
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    metadataURI: input.metadataURI.trim(),
    salt,
    minTokensOut: input.minTokensOut ?? 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + (input.deadlineSeconds ?? 600)),
  };
}

export function marketCapWei(priceX18: bigint, circulating: bigint): bigint {
  return (priceX18 * circulating) / 10n ** 18n;
}

export function fdvWei(priceX18: bigint, totalSupply: bigint): bigint {
  return (priceX18 * totalSupply) / 10n ** 18n;
}

export function minOut(amount: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.min(5_000, Math.max(1, slippageBps)));
  return (amount * (10_000n - bps)) / 10_000n;
}

export const STATE_LABEL: Record<number, "CURVE" | "GRADUATED" | "UNKNOWN"> = {
  1: "CURVE",
  2: "GRADUATED",
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export function venueName(venue: number): "curve" | "uniswap_v4" {
  return venue === 1 ? "uniswap_v4" : "curve";
}

export function tradePriceX18(quoteAmount: bigint, tokenAmount: bigint): bigint {
  if (tokenAmount === 0n) return 0n;
  return (quoteAmount * 10n ** 18n) / tokenAmount;
}

export function progressBps(realQuote: bigint, target: bigint, graduated = false): number {
  if (graduated) return 10_000;
  if (target === 0n) return 0;
  const bps = (realQuote * 10_000n) / target;
  return Number(bps > 10_000n ? 10_000n : bps);
}

export function clampSlippageBps(bps: number): number {
  if (!Number.isFinite(bps)) return 100;
  return Math.min(5_000, Math.max(1, Math.floor(bps)));
}
