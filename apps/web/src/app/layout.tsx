import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { isStatusPageEnabled, loadPublicEnv, publicWalletAvailability } from "@fused-ai/config/public";
import { SiteHeader } from "../components/SiteHeader.tsx";
import { SiteFooter } from "../components/SiteFooter.tsx";
import { Providers } from "../components/Providers.tsx";
import "@fused-ai/ui/styles.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--fused-display",
  weight: ["500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--fused-logo",
  weight: ["500", "700"],
});

export const dynamic = "force-dynamic";

const SITE_URL = "https://www.fusedai.org";
const SITE_TITLE = "FUSED AI — Launch Tokens From Posts";
const SITE_DESCRIPTION =
  "Turn a post into a token with AI. Create, launch and trade through the FUSED bonding curve.";
const OG_IMAGE = `${SITE_URL}/brand/og-1200x630.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/` },
  icons: { icon: "/brand/favicon.svg" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/`,
    siteName: "FUSED AI",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "FUSED AI — Launch a token from a post.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#f4f7fb",
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
  const showStatus = isStatusPageEnabled();

  return (
    <html lang="en">
      <body className={`${dmSans.className} ${plusJakarta.variable} ${spaceGrotesk.variable} fused-shell`}>
        <Providers wallet={wallet}>
          <SiteHeader walletConfigured={walletConfigured} />
          {children}
          <SiteFooter showStatus={showStatus} />
        </Providers>
      </body>
    </html>
  );
}
