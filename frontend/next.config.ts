import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // iOS（Capacitor）は静的ファイルを WebView に同梱して動かすため、静的書き出しにする。
  // この画面はすべてクライアントコンポーネントで、サーバー側の処理は Workers に
  // 逃がしてあるので export で失うものはない。→ docs/platform-strategy.md
  output: "export",

  images: {
    // export では Next の画像最適化サーバーが存在しないため最適化を無効化する。
    // 代わりに素材そのものを表示サイズに合わせて用意すること。
    unoptimized: true,

    // 写真は Worker の /api/photo 経由で配信する（Places のキーを露出させないため）。
    // ベース URL を変えたらここも追従させること。→ backend/README.md
    remotePatterns: [
      { protocol: "https", hostname: "durian-map-api.dailyreading.workers.dev" },
      { protocol: "http", hostname: "localhost", port: "8787" },
    ],
  },
};

export default nextConfig;
