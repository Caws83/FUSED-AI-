import { getAddress, verifyMessage, type Address, type Hex } from "viem";
import { createDatabaseClient } from "@fused-ai/database";
import type { FusedEnv } from "@fused-ai/config";
import { fusedProfileUpdateMessage, parseFusedProfileUpdate } from "@fused-ai/validation";

export type ProfileJson = {
  ok: boolean;
  address?: string;
  displayName?: string | null;
  pfpUrl?: string | null;
  nonce?: number;
  error?: string;
};

function checksum(address: string): Address | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

export async function readFusedProfile(
  rawAddress: string,
  env: FusedEnv,
): Promise<{ status: number; body: ProfileJson }> {
  const address = checksum(rawAddress);
  if (!address) {
    return { status: 400, body: { ok: false, error: "Connect a wallet to edit your profile." } };
  }
  const db = createDatabaseClient(env);
  const profile = await db.getFusedProfile(address);
  await db.close();
  if (!profile.ok) {
    return { status: 503, body: { ok: false, error: "Profile is temporarily unavailable." } };
  }
  return {
    status: 200,
    body: {
      ok: true,
      address,
      displayName: profile.value.displayName,
      pfpUrl: profile.value.pfpUrl,
      nonce: profile.value.nonce,
    },
  };
}

export async function applySignedFusedProfile(
  input: unknown,
  env: FusedEnv,
): Promise<{ status: number; body: ProfileJson }> {
  const parsed = parseFusedProfileUpdate(input);
  if (!parsed.ok) return { status: 400, body: { ok: false, error: parsed.error } };

  const address = checksum(parsed.address);
  if (!address) {
    return { status: 400, body: { ok: false, error: "Connect a wallet to edit your profile." } };
  }

  const message = fusedProfileUpdateMessage({
    address,
    displayName: parsed.displayName,
    pfpUrl: parsed.pfpUrl ?? "",
    nonce: parsed.nonce,
  });

  let signed = false;
  try {
    signed = await verifyMessage({
      address,
      message,
      signature: parsed.signature as Hex,
    });
  } catch {
    signed = false;
  }
  if (!signed) return { status: 401, body: { ok: false, error: "Invalid signature." } };

  const db = createDatabaseClient(env);
  const saved = await db.upsertFusedProfile({
    walletAddress: address,
    displayName: parsed.displayName,
    pfpUrl: parsed.pfpUrl,
    expectedNonce: parsed.nonce,
  });
  await db.close();
  if (!saved.ok) {
    return { status: 503, body: { ok: false, error: "Profile is temporarily unavailable." } };
  }
  if (!saved.value.applied || !saved.value.profile) {
    return { status: 409, body: { ok: false, error: "This profile update was already used." } };
  }
  return {
    status: 200,
    body: {
      ok: true,
      address,
      displayName: saved.value.profile.displayName,
      pfpUrl: saved.value.profile.pfpUrl,
      nonce: saved.value.profile.nonce,
    },
  };
}
