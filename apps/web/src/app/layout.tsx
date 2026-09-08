import type { ReactNode } from "react";
import { DM_Sans, Syne } from "next/font/google";
import { loadEnv, walletAvailability } from "@fused-ai/config";
import { SiteHeader } from "../components/SiteHeader.tsx";
import { Providers } from "../components/Providers.tsx";
import "@fused-ai/ui/styles.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--fused-display",
});

export const dynamic = "force-dynamic";

export const metadata = {
  title: "FUSED AI",
  description: "Launch a token from a post. One post. One click. One token.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const env = loadEnv();
  const walletConfigured = walletAvailability(env).status === "OK";
  const wallet =
    walletConfigured && env.chainId && env.rpcUrl
      ? {
          chainId: env.chainId,
          rpcUrl: env.rpcUrl,
          walletConnectProjectId: env.walletConnectProjectId,
        }
      : null;

  return (
    <html lang="en">
      <body className={`${dmSans.className} ${syne.variable} fused-shell`}>
        <Providers wallet={wallet}>
          <SiteHeader walletConfigured={walletConfigured} />
          {children}
          <footer className="fused-footer">
            <div className="fused-wrap" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span>FUSED AI · social-first launchpad</span>
              <a href="/status">System status</a>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
