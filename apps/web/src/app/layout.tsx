import type { ReactNode } from "react";
import { DM_Sans, Syne } from "next/font/google";
import { loadPublicEnv, publicWalletAvailability } from "@fused-ai/config";
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
  icons: { icon: "/brand/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const pub = loadPublicEnv();
  const walletConfigured = publicWalletAvailability(pub).status === "OK";
  const wallet =
    walletConfigured && pub.chainId && pub.rpcUrl
      ? {
          chainId: pub.chainId,
          rpcUrl: pub.rpcUrl,
          walletConnectProjectId: pub.walletConnectProjectId,
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
              <span>FUSED AI</span>
              <a href="/status">Status</a>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
