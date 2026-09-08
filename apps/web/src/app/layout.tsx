import type { ReactNode } from "react";

export const metadata = {
  title: "Fused AI",
  description: "Launch a token with just 1 click from a tweet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#0b0f14",
          color: "#e8eef5",
        }}
      >
        {children}
      </body>
    </html>
  );
}
