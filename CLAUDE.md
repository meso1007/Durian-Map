# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Durian-Map** は「チェーンじゃない、あの一杯へ。」— スタバやドトールに飽きた人のための、
**個人経営の小さなカフェを見つけるマップ**。指定エリア（または現在地の周辺）のカフェを
Google Places から取得し、**チェーン店をサーバー側で除外**して地図とリストで見せる。
気に入った店は端末内に保存できる。

## 作業前に読むもの

| ファイル | 内容 |
|---|---|
| [README.md](README.md) | 全体構成・セットアップ |
| [docs/platform-strategy.md](docs/platform-strategy.md) | Web / iOS の方針（API 1 つ・UI 1 つ、iOS は Capacitor） |
| [docs/design.md](docs/design.md) | **デザイン規約。UI を触る前に必読** |
| [docs/design-tokens.md](docs/design-tokens.md) | 色とブランドマーク（色の正） |
| [ToDo.md](ToDo.md) | 現在のマイルストーンと残タスク |
| [tasks/lessons.md](tasks/lessons.md) | 過去に踏んだ落とし穴。着手前に目を通す |

## Development Commands

パッケージマネージャ / ランタイムは **Bun**。

```bash
# API（Cloudflare Workers / Hono）
cd backend && bun install && bun run dev      # http://localhost:8787
cd backend && bun run deploy                  # 本番へデプロイ

# フロント（Next.js。Web と iOS 共通）
cd frontend && bun install && bun run dev     # http://localhost:3000
cd frontend && bun run deploy                 # → https://durian-map.pages.dev
cd frontend && bun run lint

# iOS（Capacitor。CocoaPods 不要 / 依存は SPM）
cd frontend && bun run build:ios              # 静的書き出し → iOS プロジェクトへ同期
cd frontend && bun run ios                    # Xcode で開く
```

自動テストは無い。検証は実際に動かして行う（`tasks/todo.md` に記録を残す）。

## Architecture

```
backend/       Cloudflare Workers（Hono）      → https://durian-map-api.dailyreading.workers.dev
frontend/      Next.js 16（output: 'export'）  → https://durian-map.pages.dev
frontend/ios/  Capacitor（同じ成果物を WebView に同梱）
```

### リクエストの流れ
1. ユーザーがエリア名を入力、または「近くからさがす」
2. フロントが Worker の `/api/search` を叩く（`frontend/src/lib/api.ts` 経由）
3. Worker が Google Places API v1 を呼び、**`backend/src/chains.ts` の
   `isChainCafe()` でチェーン店を除外**してから返す
4. フロントが地図とリストに描画。写真は `/api/photo`（キーを露出させないプロキシ）

### 触る前に知っておくこと
- **チェーン店判定の正は `backend/src/chains.ts` の 1 箇所**。フロントや iOS で書き直さない。
- **実体が Web / iOS で変わるものは `frontend/src/lib/` を必ず通す。**
  UI から `fetch` / `localStorage` / `navigator.geolocation` / `navigator.share` を直接呼ばない
  （`api.ts` / `storage.ts` / `geolocation.ts` / `share.ts` / `platform.ts`）。
- 画面は `frontend/src/app/page.tsx` の 1 ファイル。状態は `useState` のみで外部ライブラリ無し。
- 地図は `frontend/src/app/components/MapView.tsx`（`@vis.gl/react-google-maps`）。
- ブランド素材の正は `designs/durian-map-tropical.pen`。SVG は
  `designs/pen-frame-to-svg.py` で起こす（手で描き足さない）。

## Tech Stack

| レイヤ | 技術 |
|---|---|
| ランタイム | Bun |
| API | Cloudflare Workers / Hono v4（KV でキャッシュとレート制限） |
| フロント | Next.js 16 / React 19 / Tailwind CSS v4（静的書き出し） |
| iOS | Capacitor 8（WebView。依存は Swift Package Manager） |
| 外部 API | Google Places API v1 / Maps JavaScript API |
| 永続化 | 端末内のみ（Web: localStorage / iOS: Capacitor Preferences） |

## Key Constraints

- **早期 MVP**。変更は最小限・対象を絞って行う。
- データベースは無い。保存は端末内だけで、サーバーには送らない。
- API キーは 2 つに分ける。Places 用は Worker の secret（`GOOGLE_API_KEY`）、
  地図用は `frontend/.env.local`。**フロントに Places のキーを埋め込まない。**
- フロントの公開 URL を変えたら `backend/wrangler.jsonc` の `ALLOWED_ORIGINS` に
  追加して Worker を再デプロイする。忘れると本番で CORS に弾かれる。
  （iOS アプリの Origin は環境で変わらないので `src/index.ts` 側で常に許可している）
- ダークモードは対応しない（ライトのみ）。
