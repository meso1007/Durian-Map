# CLAUDE.md

このリポジトリで作業するエージェント（Claude Code / Codex など）向けのガイド。

セットアップ手順・環境変数・デプロイ先は [README.md](README.md) が正。ここでは重複させず、
**コードを触るときに知っておくべき構造と制約**だけを書く。
過去に踏んだ落とし穴は [tasks/lessons.md](tasks/lessons.md)。着手前に目を通す。

## プロダクト概要

**Durian Map** は、チェーン店を除外して個人経営の小さなカフェを地図で探すアプリ。

> 注意: 元は「Web プレゼンスの弱い事業者を見つける B2B リード生成ツール」だった。
> 型名 `Lead` や API レスポンスの `{ leads: [...] }` はその名残で、現在の意味は
> 「検索結果のカフェ」。新しいコードで `Lead` の語を広げないこと。

## 構成

| レイヤ | 技術 | 場所 | デプロイ先 |
|---|---|---|---|
| API | Cloudflare Workers / Hono v4 / Zod | `backend/` | https://durian-map-api.dailyreading.workers.dev |
| フロント（Web） | Next.js 16（App Router / `output: 'export'`）/ React 19 / Tailwind v4 | `frontend/` | https://durian-map.pages.dev（Cloudflare Pages） |
| iOS アプリ | Capacitor 8（同じ静的書き出しを WebView に同梱。依存は SPM） | `frontend/ios/` | ローカルビルドのみ |
| 外部 API | Google Places API (New) / Maps JavaScript API | — | — |
| 永続化 | 端末内のみ（Web: localStorage / iOS: Capacitor Preferences）。DB なし | — | — |

パッケージマネージャ・ランタイムは **Bun**。**iOS は Web と同じコードから作る**。iOS 用に UI を別実装しないこと。

## リクエストの流れ

1. フロントが `GET {NEXT_PUBLIC_API_BASE_URL}/api/search?category=...` を呼ぶ
   （エリア検索なら `&area=`、現在地検索なら `&lat=&lng=&radius=`）
2. Worker が KV キャッシュを見る → ヒットすれば `{ leads, cached: true }` を返す
3. ミス時は Places API (New) の `searchText` / `searchNearby` を呼ぶ
4. `keepIndependentCafe()` が `isChainCafe()` でチェーン店を落とす
5. 残りを `Lead` に変換して返し、キャッシュへ書き込む（`waitUntil` でレスポンスは待たせない）
6. フロントが描画。保存は端末内（`lib/storage.ts`）

## バックエンド（`backend/src/`）

| ファイル | 役割 |
|---|---|
| `index.ts` | Hono アプリ本体。ルート定義、CORS、レート制限、入力バリデーション（Zod）。iOS の Origin（`capacitor://localhost`）は `NATIVE_APP_ORIGINS` で常に許可 |
| `places.ts` | Places API (New) 呼び出し。`FIELD_MASK`、上流タイムアウト 8 秒、`PlacesApiError` |
| `chains.ts` | **チェーン店判定の正**（`isChainCafe`）。フロントや iOS 側で書き直さないこと |
| `cache.ts` | KV による検索キャッシュ（TTL 24 時間）。`Lead` にフィールドを足したら `SCHEMA_VERSION` を上げる |
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
- CORS 許可オリジンは `wrangler.jsonc` の `ALLOWED_ORIGINS`（本番 Pages URL + localhost）。判定は完全一致なので Pages のプレビュー URL は弾かれる
- KV バインディング `CACHE` を検索キャッシュとレート制限の両方で使う
- 同じ Worker 名を複数ワークツリーからデプロイすると互いに上書きする（→ `tasks/lessons.md`）

## フロントエンド（`frontend/src/`）

| ファイル | 役割 |
|---|---|
| `app/page.tsx` | 画面本体。状態は `useState` / `useEffect` のみ（状態ライブラリなし） |
| `app/components/MapView.tsx` | 地図。`@vis.gl/react-google-maps` + `@googlemaps/markerclusterer`。ピンの枠色で営業状態を表す |
| `lib/api.ts` | 検索 API クライアント。`Cafe` 型・`ApiError`・`getCafePhotoUrl()` |
| `lib/storage.ts` | 保存済みカフェの永続化（`SavedCafe` = `Cafe` + `status` + `savedAt`）。Web は localStorage、iOS は Preferences |
| `lib/geolocation.ts` | 現在地取得。Web は `navigator.geolocation`、iOS は Capacitor Geolocation |
| `lib/share.ts` | 共有。Web Share API → クリップボード → Capacitor Share |
| `lib/platform.ts` | ネイティブ判定（`isNativePlatform()`）。UI から `Capacitor` を直接 import しない |
| `app/layout.tsx` | フォント定義（`--font-sans` = M PLUS Rounded 1c、`--font-display` = Co Headline）、`viewportFit: 'cover'` |
| `app/globals.css` | デザイントークンの CSS 変数 |
| `capacitor.config.ts` / `ios/` | iOS（Capacitor）。`bun run build:ios` で `out/` を同期 |
| `scripts/gen-ios-assets.mjs` | アプリアイコン / スプラッシュ生成（`bun run ios:assets`） |

### 守ること

- **実体が Web / iOS で変わるものは `lib/` を必ず通す**: `fetch` → `lib/api.ts`、`localStorage` → `lib/storage.ts`、
  `navigator.geolocation` → `lib/geolocation.ts`、`navigator.share` / `clipboard` / `alert` → `lib/share.ts` + トースト
- **UI を触る前に [docs/design.md](docs/design.md) を読む**（グラデーション禁止などの明示的な却下事項がある）
- 色は [docs/design-tokens.md](docs/design-tokens.md) が正。ハードコードの hex を新たに増やさない
- ブランド素材の正は `designs/durian-map-tropical.pen`。SVG は `designs/pen-frame-to-svg.py` で起こす（手で描き足さない）
- `places.ts` の `FIELD_MASK` を安易に増やさない（Places の課金ティアが上がる）
- 本番ビルドの `NEXT_PUBLIC_*` は `package.json` の `build:prod` で明示指定する（`.env.local` が優先されて localhost が焼き込まれるのを防ぐ）

## 検証

自動テストは無い。変更後は最低限これを通す:

```bash
cd backend  && bun run typecheck
cd frontend && bun run lint && bun run build:prod
cd frontend && bun run build:ios   # iOS を触ったとき（Xcode が要る）
```

## 既知の状態

- API は Cloudflare Workers、フロントは Cloudflare Pages にデプロイ済み。iOS はシミュレータで確認済み、App Store 未提出
- iOS 配布前に必要: `capacitor://` にはリファラー制限が効かないので **iOS 用の地図キー**を別に作る
