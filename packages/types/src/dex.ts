export type DexVersion = "v2" | "v3" | "v4";

export type DexAdapterInfo = {
  version: DexVersion;
  implemented: boolean;
  available: boolean;
  reason: string | null;
};

export type ChainRef = {
  chainId: number;
  name: string;
  rpcConfigured: boolean;
};
