import { isLocalhostUrl } from "@fused-ai/config";

function hostnameOf(databaseUrl: string): string | null {
  try {
    return new URL(databaseUrl.replace(/^postgres(ql)?:/i, "https:")).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Local Docker and Railway private DNS do not need TLS. Public proxies do. */
export function postgresSslMode(databaseUrl: string): false | "require" {
  if (/[?&]sslmode=disable\b/i.test(databaseUrl)) return false;
  if (isLocalhostUrl(databaseUrl)) return false;
  const host = hostnameOf(databaseUrl);
  if (host?.endsWith(".railway.internal")) return false;
  return "require";
}

export function postgresClientOptions(databaseUrl: string): {
  max: number;
  idle_timeout: number;
  connect_timeout: number;
  prepare: boolean;
  ssl?: "require";
} {
  const vercel = Boolean(process.env.VERCEL);
  const ssl = postgresSslMode(databaseUrl);
  return {
    max: vercel ? 1 : 4,
    idle_timeout: 20,
    connect_timeout: vercel ? 8 : 15,
    prepare: !vercel,
    ...(ssl ? { ssl } : {}),
  };
}
