import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Ruang Order — kelola pesananmu",
  description: "Catat pesanan reseller, hitung profit, dan bagikan progres dengan kode order.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="id"><body>{children}</body></html>;
}
