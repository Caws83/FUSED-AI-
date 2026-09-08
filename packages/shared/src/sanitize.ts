const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strip control characters. Does not attempt to make untrusted text "safe" for LLM prompts. */
export function stripControlChars(input: string): string {
  return input.replace(CONTROL, "");
}

export function clampText(input: string, max: number): string {
  const cleaned = stripControlChars(input).trim();
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max);
}

const HEX_ADDR = /^0x[0-9a-fA-F]{40}$/;

export function isHexAddress(value: string): boolean {
  return HEX_ADDR.test(value);
}

export function lowercaseAddress(value: string): string {
  if (!isHexAddress(value)) throw new Error("invalid address");
  return value.toLowerCase();
}

/** Allow only http(s) URLs. Reject javascript:, data:, etc. */
export function sanitizeHttpUrl(value: string, max = 500): string | null {
  const trimmed = stripControlChars(value).trim().slice(0, max);
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}
