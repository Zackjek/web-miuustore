import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miuu Store — little order studio",
  description: "Catat pesanan Miuu Store, hitung profit, dan bagikan progres dengan kode order.",
  icons: {
    icon: "/favicon.svg?v=3",
    shortcut: "/favicon.svg?v=3",
    apple: [{ url: "/apple-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Miuu Store",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}