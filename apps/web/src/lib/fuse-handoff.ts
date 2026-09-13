import { clampText } from "@fused-ai/shared";
import { FUSE_POST_TEXT_MAX } from "@fused-ai/validation";

export const FUSE_HANDOFF_KEY = "fused.fuseHandoff";
export const FUSE_HANDOFF_MIN = 8;

type FuseHandoffPayload = {
  v: 1;
  text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clientSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function normalizeFuseHandoffText(text: string): string | null {
  const clipped = clampText(text, FUSE_POST_TEXT_MAX);
  if (clipped.length < FUSE_HANDOFF_MIN) return null;
  return clipped;
}

export function writeFuseHandoff(text: string, storage?: Storage): boolean {
  const clipped = normalizeFuseHandoffText(text);
  if (!clipped) return false;
  const store = storage ?? clientSessionStorage();
  if (!store) return false;
  const payload: FuseHandoffPayload = { v: 1, text: clipped };
  try {
    store.setItem(FUSE_HANDOFF_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read-and-delete. A refresh or remount cannot take the same payload twice.
 */
export function takeFuseHandoff(storage?: Storage): string | null {
  const store = storage ?? clientSessionStorage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(FUSE_HANDOFF_KEY);
    store.removeItem(FUSE_HANDOFF_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const text = isRecord(parsed) && typeof parsed.text === "string" ? parsed.text : null;
    return text ? normalizeFuseHandoffText(text) : null;
  } catch {
    return null;
  }
}
