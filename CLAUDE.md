# CLAUDE.md

このリポジトリで作業するエージェント（Claude Code / Codex など）向けのガイド。

セットアップ手順・環境変数・デプロイ先は [README.md](README.md) が正。ここでは重複させず、
**コードを触るときに知っておくべき構造と制約**だけを書く。

## プロダクト概要

**Durian Map** は、チェーン店を除外して個人経営の小さなカフェを地図で探すアプリ。

> 注意: 元は「Web プレゼンスの弱い事業者を見つける B2B リード生成ツール」だった。
> 型名 `Lead` や API レスポンスの `{ leads: [...] }` はその名残で、現在の意味は
> 「検索結果のカフェ」。新しいコードで `Lead` の語を広げないこと。

## 構成

| レイヤ | 技術 | 場所 |
|---|---|---|
| API | Cloudflare Workers / Hono v4 / Zod | `backend/` |
| フロント | Next.js 16（App Router）/ React 19 / Tailwind v4 | `frontend/` |
| 外部 API | Google Places API (New) | — |
| 永続化 | ブラウザの localStorage のみ（DB なし） | — |

パッケージマネージャ・ランタイムは **Bun**。

## リクエストの流れ

1. フロントが `GET {NEXT_PUBLIC_API_BASE_URL}/api/search?category=...` を呼ぶ
   （エリア検索なら `&area=`、現在地検索なら `&lat=&lng=&radius=`）
2. Worker が KV キャッシュを見る → ヒットすれば `{ leads, cached: true }` を返す
3. ミス時は Places API (New) の `searchText` / `searchNearby` を呼ぶ
4. `keepIndependentCafe()` が `isChainCafe()` でチェーン店を落とす
5. 残りを `Lead` に変換して返し、キャッシュへ書き込む（`waitUntil` でレスポンスは待たせない）
6. フロントが描画。保存はブラウザの localStorage

## バックエンド（`backend/src/`）

| ファイル | 役割 |
|---|---|
| `index.ts` | Hono アプリ本体。ルート定義、CORS、レート制限、入力バリデーション（Zod） |
| `places.ts` | Places API (New) 呼び出し。`FIELD_MASK`、上流タイムアウト 8 秒、`PlacesApiError` |
| `chains.ts` | **チェーン店判定の正**（`isChainCafe`）。フロントや iOS 側で書き直さないこと |
| `cache.ts` | KV による検索キャッシュ（TTL 24 時間） |
| `ratelimit.ts` | KV によるレート制限（60 秒あたり 30 リクエスト） |
| `types.ts` | `Env` / `Place` / `Lead` / `SearchResponse` |

### エンドポイント

| メソッド・パス | 内容 |
|---|---|
| `GET /health` | ヘルスチェック |
| `GET /api/search` | カフェ検索。`category` 必須、`area` または `lat`+`lng` のどちらかが必須。`radius` は既定 1500m / 上限 50000m |
| `GET /api/photo` | Places の写真プロキシ。**フロントに Places のキーを渡さないため**に必ずここを経由する |

### 設定

- `GOOGLE_API_KEY` は **secret**。`wrangler secret put GOOGLE_API_KEY` で設定し、ローカルは `backend/.dev.vars`。`wrangler.jsonc` には書かない
- CORS 許可オリジンは `wrangler.jsonc` の `ALLOWED_ORIGINS`（未設定時は localhost:3000 のみ）
- KV バインディング `CACHE` を検索キャッシュとレート制限の両方で使う

## フロントエンド（`frontend/src/`）

| ファイル | 役割 |
|---|---|
| `app/page.tsx` | 画面本体。状態は `useState` / `useEffect` のみ（状態ライブラリなし） |
| `app/components/MapView.tsx` | 地図。`@vis.gl/react-google-maps` + `@googlemaps/markerclusterer` |
| `lib/api.ts` | 検索 API クライアント。`Cafe` 型・`ApiError`・`getCafePhotoUrl()` |
| `lib/storage.ts` | 保存済みカフェの永続化。実体は localStorage だが API は非同期 |
| `app/layout.tsx` | フォント定義（`--font-sans` = M PLUS Rounded 1c、`--font-display` = Co Headline） |
| `app/globals.css` | デザイントークンの CSS 変数 |

### 守ること

- **UI から直接 `fetch` しない** — 通信は `lib/api.ts` に集約する（iOS/Capacitor でベース URL を差し替えるため）
- **UI から直接 `localStorage` を呼ばない** — `lib/storage.ts` を通す（実体の差し替えを前提に非同期 API にしてある）
- **UI を触る前に [docs/design.md](docs/design.md) を読む**（グラデーション禁止などの明示的な却下事項がある）
- 色は [docs/design-tokens.md](docs/design-tokens.md) が正。ハードコードの hex を新たに増やさない
- `places.ts` の `FIELD_MASK` を安易に増やさない（Places の課金ティアが上がる）

## 検証

自動テストは無い。変更後は最低限これを通す:

```bash
cd backend  && bun run typecheck
cd frontend && bun run lint && bun run build
```

## 既知の状態

- フロントは未デプロイ（Vercel 想定）。API は Cloudflare Workers にデプロイ済み
- `leaflet` / `react-leaflet` が `frontend/package.json` に残っているが、ソースからは参照されていない（地図は Google Maps に移行済み）
