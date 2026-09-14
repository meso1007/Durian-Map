import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 写真は Worker の /api/photo 経由で配信する（Places のキーを露出させないため）。
    // ベース URL を変えたらここも追従させること。→ backend/README.md
    remotePatterns: [
      { protocol: "https", hostname: "durian-map-api.dailyreading.workers.dev" },
      { protocol: "http", hostname: "localhost", port: "8787" },
    ],
  },
};

export default nextConfig;
