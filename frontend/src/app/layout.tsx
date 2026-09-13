import type { Metadata, Viewport } from "next";
import { Geist_Mono, M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const geistSans = M_PLUS_Rounded_1c({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Durian Map",
  description: "スタバもドトールも飽きたあなたへ。個人経営や小さなお気に入りカフェを見つけるためのマップ。",
  manifest: "/manifest.json",
  appleWebApp: {
    title: "Durian Map",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // iOS Safariのズーム防止
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
