# Durian-Map

スタバもドトールも飽きたあなたへ。個人経営の小さなカフェを見つけるマップ。

## ドキュメント（作業前に読む）

| ファイル | 内容 |
|---|---|
| [docs/platform-strategy.md](docs/platform-strategy.md) | Web / iOS の方針（結論: API 1 つ・UI 2 つ、iOS は Capacitor） |
| [docs/design.md](docs/design.md) | **デザイン規約。UI を触る前に必読**（グラデーション禁止・タグの扱い・フォント） |
| [docs/design-tokens.md](docs/design-tokens.md) | カラートークン（色の正） |
| [backend/README.md](backend/README.md) | API 仕様・デプロイ手順 |

## 構成

| レイヤ | 技術 | 場所 | デプロイ先 |
|---|---|---|---|
| API | Cloudflare Workers / Hono | `backend/` | https://durian-map-api.itto-hp.workers.dev |
| フロント | Next.js 16 / React 19 / Tailwind v4 | `frontend/` | 未デプロイ（Vercel 想定） |

チェーン店判定ロジックの正は `backend/src/chains.ts`。フロントや iOS 側で書き直さないこと。

## セットアップ

### バックエンド（Cloudflare Workers）

```bash
cd backend
bun install
cp .dev.vars.example .dev.vars   # GOOGLE_API_KEY に Places API (New) のキーを入れる
bun run dev                      # http://localhost:8787
```

本番の API キーは secret として設定する（リポジトリには入れない）:

```bash
cd backend && bunx wrangler secret put GOOGLE_API_KEY
```

詳細は [backend/README.md](backend/README.md)。

### フロントエンド（Next.js）

```bash
cd frontend
bun install
cp .env.example .env.local
bun run dev                      # http://localhost:3000
```

`frontend/.env.local` に設定するもの:

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 地図表示（Maps JavaScript API 用。HTTP リファラー制限をかけること） |
| `NEXT_PUBLIC_API_BASE_URL` | 検索 API のベース URL。ローカルは `http://localhost:8787` |

> 写真の表示は Worker の `/api/photo` 経由で行う。フロントに Places のキーを埋め込まないこと。

## 注意

- API キーは**地図用とPlaces用で分ける**（Google Console で制限を分けやすい）
- フロントを本番デプロイしたら、その URL を `backend/wrangler.jsonc` の `ALLOWED_ORIGINS` に追加して再デプロイする
