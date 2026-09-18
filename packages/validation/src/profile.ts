import { clampText, isHexAddress, sanitizeHttpUrl } from "@fused-ai/shared";

export const FUSED_PROFILE_NAME_MAX = 32;
export const FUSED_PROFILE_PFP_MAX = 500;

const LOCAL_PFP = /^\/api\/media\/[a-f0-9]{32}\.(png|jpe?g|webp)$/i;
const SIGNATURE = /^0x[0-9a-fA-F]{128,196}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFusedDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");
  const name = clampText(stripped, FUSED_PROFILE_NAME_MAX);
  return name.length > 0 ? name : null;
}

export function parseFusedPfpUrl(value: unknown): { ok: true; url: string | null } | { ok: false } {
  if (value == null) return { ok: true, url: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, url: null };
  if (LOCAL_PFP.test(trimmed)) return { ok: true, url: trimmed };
  const url = sanitizeHttpUrl(trimmed, FUSED_PROFILE_PFP_MAX);
  if (!url) return { ok: false };
  return { ok: true, url };
}

export function fusedProfileUpdateMessage(input: {
  address: string;
  displayName: string;
  pfpUrl: string;
  nonce: number;
}): string {
  return [
    "FUSED profile update",
    `address:${input.address}`,
    `name:${input.displayName}`,
    `pfp:${input.pfpUrl}`,
    `nonce:${input.nonce}`,
  ].join("\n");
}

export type FusedProfileUpdate =
  | {
      ok: true;
      address: string;
      displayName: string;
      pfpUrl: string | null;
      nonce: number;
      signature: `0x${string}`;
    }
  | { ok: false; error: string };

export function parseFusedProfileUpdate(input: unknown): FusedProfileUpdate {
  if (!isRecord(input)) return { ok: false, error: "Invalid request." };
  const address = typeof input.address === "string" ? input.address.trim() : "";
  if (!isHexAddress(address)) return { ok: false, error: "Connect a wallet to edit your profile." };
  const displayName = parseFusedDisplayName(input.displayName);
  if (!displayName) return { ok: false, error: "Enter a display name." };
  const pfp = parseFusedPfpUrl(input.pfpUrl);
  if (!pfp.ok) return { ok: false, error: "Choose a valid profile image." };
  const nonce = input.nonce;
  if (typeof nonce !== "number" || !Number.isInteger(nonce) || nonce < 0 || nonce > Number.MAX_SAFE_INTEGER) {
    return { ok: false, error: "Invalid profile update." };
  }
  const signature = typeof input.signature === "string" ? input.signature.trim() : "";
  if (!SIGNATURE.test(signature)) return { ok: false, error: "Sign the profile update with your wallet." };
  return {
    ok: true,
    address,
    displayName,
    pfpUrl: pfp.url,
    nonce,
    signature: signature as `0x${string}`,
  };
}
