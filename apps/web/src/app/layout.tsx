import type { ReactNode } from "react";
import type { Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { loadPublicEnv, publicWalletAvailability } from "@fused-ai/config/public";
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

export const metadata = {
  title: "FUSED AI",
  description: "Launch a token from a post. One post. One click. One token.",
  icons: { icon: "/brand/favicon.svg" },
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#f4f7fb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const pub = loadPublicEnv();
  const walletConfigured = publicWalletAvailability(pub).status === "OK";

  return (
    <html lang="en">
      <body className={`${dmSans.className} ${plusJakarta.variable} ${spaceGrotesk.variable} fused-shell`}>
        <Providers>
          <SiteHeader walletConfigured={walletConfigured} />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
