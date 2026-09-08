import { readFile } from "node:fs/promises";
import type { TrackedAccount } from "@fused-ai/types";
import { notConfigured } from "@fused-ai/types";
import { err, ok, type Result } from "@fused-ai/shared";
import { parseTrackedAccounts } from "@fused-ai/validation";

export async function loadTrackedAccounts(path: string | null): Promise<Result<readonly TrackedAccount[]>> {
  if (!path) return err(notConfigured(["TRACKED_ACCOUNTS_PATH"]));
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    return err({
      status: "NOT_CONFIGURED",
      missing: ["TRACKED_ACCOUNTS_PATH"],
      reason: `Tracked account registry unreadable: ${e instanceof Error ? e.message : "unknown error"}`,
    });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err({ status: "NOT_CONFIGURED", reason: "Tracked account registry is not valid JSON" });
  }
  return ok(parseTrackedAccounts(json));
}
