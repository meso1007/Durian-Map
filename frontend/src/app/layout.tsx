import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// 日本語・本文（docs/design.md 2節）
const rounded = M_PLUS_Rounded_1c({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

// ロゴ・英字見出し・数値（Co Headline / Dalton Maag）
const coHeadline = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "./fonts/CoHeadline-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/CoHeadline-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/CoHeadline-Bold.woff2", weight: "700", style: "normal" },
  ],
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
  themeColor: "#1F6B3F", // ヘッダーの --dm-primary に合わせる
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // iOS Safariのズーム防止
  viewportFit: "cover", // ノッチ/ホームインジケータ領域まで描画し env(safe-area-inset-*) を有効にする
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // フォント変数は html に付ける（Tailwind の @theme が :root に出す
    // --font-sans / --font-display の自己参照を、レイヤー外の宣言で上書きするため）
    <html lang="ja" className={`${rounded.variable} ${coHeadline.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
