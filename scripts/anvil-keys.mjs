/** Well-known Foundry Anvil keys. Never valid on a public chain. */
export const ANVIL_PRIVATE_KEYS = new Set([
  "0xac0974bec39a17d36e8e7151ddb29e79448baab2c5c4c87ef57e63cd226c4604",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141561beed95cde71f709d7b5004d3",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
]);

export function normalizePrivateKey(value) {
  if (!value) return "";
  const v = String(value).trim();
  if (!v) return "";
  return v.startsWith("0x") ? v.toLowerCase() : `0x${v.toLowerCase()}`;
}

export function isAnvilPrivateKey(value) {
  const key = normalizePrivateKey(value);
  return Boolean(key) && ANVIL_PRIVATE_KEYS.has(key);
}

export function looksLikePrivateKey(value) {
  return /^0x[a-f0-9]{64}$/.test(normalizePrivateKey(value));
}
