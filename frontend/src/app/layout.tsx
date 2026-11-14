import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// 日本語・本文（docs/design.md 2節）
//
// preload を切っているのは CJK フォントだから。next/font は日本語を数百の
// unicode-range に分割するので、既定の preload: true だと <link rel="preload"> が
// 350 本以上出て初回の帯域を地図と検索 API から奪う（実測 5.3MB）。
// display: 'swap' + fallback があれば、必要な範囲だけ遅れて読み込まれる。
// ウェイトは実際に使っている 3 つだけ（font-normal / font-medium / font-medium）。
const rounded = M_PLUS_Rounded_1c({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  preload: false,
  display: "swap",
  fallback: ["Hiragino Sans", "Noto Sans JP", "sans-serif"],
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

const TITLE = "Durian Map｜チェーンじゃない、あの一杯へ。";
const DESCRIPTION = "大手チェーンを除いて、個人経営の小さなカフェだけを地図でさがせます。近くのカフェも、気になる街のカフェも。";

export const metadata: Metadata = {
  // 共有リンクの土台。OG の URL を絶対パスにするために要る。
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://durian-map.pages.dev"),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    title: "Durian Map",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Durian Map",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/logo-512.png", width: 512, height: 512, alt: "Durian Map" }],
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: ["/logo-512.png"] },
};

export const viewport: Viewport = {
  themeColor: "#EEF5D9", // 画面の上端は地図。地図の陸地の色（--color-map-land）に合わせる
  width: "device-width",
  initialScale: 1,
  // maximumScale は指定しない。ピンチズームを塞ぐのは WCAG 1.4.4 違反で、
  // 本来の目的（入力時の自動ズーム防止）は入力欄を 16px 以上にすることで
  // すでに達成している。→ docs/design.md 6節
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
