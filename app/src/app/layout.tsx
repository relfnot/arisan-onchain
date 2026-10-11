import type { Metadata } from "next";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";

export const metadata: Metadata = {
  title: "Arisan On-Chain",
  description: "Trustless rotating savings groups on Solana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
