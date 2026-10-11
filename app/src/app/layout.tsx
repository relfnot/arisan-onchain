import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";

const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Arisan On-Chain",
  description: "Trustless rotating savings groups on Solana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
