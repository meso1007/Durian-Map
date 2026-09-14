# frontend — Durian Map

Next.js 16 / React 19 / Tailwind CSS v4。**静的書き出し（`output: 'export'`）**で
Cloudflare Pages に配信する。UI を触る前に [`docs/design.md`](../docs/design.md) を読むこと。

## セットアップ

```bash
bun install
cp .env.example .env.local   # 値を埋める
bun run dev                  # http://localhost:3000
```

API は別プロセス。`cd ../backend && bun run dev`（http://localhost:8787）を並行して起動する。

## 環境変数

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 地図表示（Maps JavaScript API） |
| `NEXT_PUBLIC_API_BASE_URL` | 検索 API のベース URL |

静的書き出しでは `NEXT_PUBLIC_*` が**ビルド時にバンドルへ焼き込まれる**。環境を変えたら
再ビルドが必要。本番ビルドの `NEXT_PUBLIC_API_BASE_URL` は `.env.local` に左右されないよう
`build:prod` スクリプトの中で明示的に指定している。

## スクリプト

| コマンド | 内容 |
|---|---|
| `bun run dev` | 開発サーバー |
| `bun run build` | ビルド（API URL は `.env.local` の値） |
| `bun run build:prod` | 本番ビルド（API URL を Workers の本番 URL に固定） |
| `bun run deploy` | 本番ビルド → Cloudflare Pages へアップロード |
| `bun run lint` | ESLint |

`next start` は無い。静的書き出しにサーバーは存在しないため。

## デプロイ

```bash
bun run deploy   # → https://durian-map.pages.dev
```

フロントの URL を変えたら **`backend/wrangler.jsonc` の `ALLOWED_ORIGINS` に追加して
`cd ../backend && bun run deploy`** すること。忘れると本番で CORS に弾かれる。

## 制約メモ

- 画像最適化は無効（`images.unoptimized`）。最適化サーバーが無いので、`public/` に置く
  画像は**あらかじめ表示サイズに合わせて用意する**。
- Pages のプレビューデプロイ（`https://<hash>.durian-map.pages.dev`）は API の
  許可オリジンに入っていないため、検索が CORS で失敗する。確認は本番 URL で行う。
