import type { Metadata } from "next";
import { Geist_Mono, M_PLUS_Rounded_1c } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = M_PLUS_Rounded_1c({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

// ブランド用ディスプレイフォント（ロゴ・英字見出し・数値）。欧文のみなので日本語は --font-geist-sans にフォールバック
const coHeadline = localFont({
  src: [
    { path: "./fonts/CoHeadline-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/CoHeadline-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/CoHeadline-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-co-headline",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Durian Map",
  description: "エリアごとのカフェ候補を地図とリストで見比べられる Durian Map。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${coHeadline.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
