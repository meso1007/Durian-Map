import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的書き出し。out/ をそのまま Cloudflare Pages に載せ、
  // 同じものを Capacitor（iOS）が WebView に同梱する。→ docs/platform-strategy.md
  output: "export",

  // 画像最適化サーバーが存在しないので無効化する。
  // 店舗写真は元々 Worker の /api/photo 経由で配信しており（キー露出を避けるため）、
  // 呼び出し側も unoptimized 指定済みなので実害はない。→ src/lib/api.ts
  images: { unoptimized: true },
};

export default nextConfig;
