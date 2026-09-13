# Durian-Map

スタバもドトールも飽きたあなたへ。個人経営の小さなカフェを見つけるマップ。

## ドキュメント（作業前に読む）

| ファイル | 内容 |
|---|---|
| [docs/platform-strategy.md](docs/platform-strategy.md) | Web / iOS の方針（結論: API 1 つ・UI 2 つ、iOS は Capacitor） |
| [docs/design.md](docs/design.md) | **デザイン規約。UI を触る前に必読**（グラデーション禁止・タグの扱い・フォント） |
| [docs/design-tokens.md](docs/design-tokens.md) | カラートークン（色の正） |

> **注意**: 以下の「バックエンド（Bun）」の記述は古い。現在 `backend/` は存在せず、
> 検索 API は `frontend/src/app/api/search/route.ts`（Next.js Route Handler）に統合済み。

## 環境変数（API キー）

フロントとバックで **別々のキー**を用意するのがおすすめです（Console で制限を分けやすい）。

### フロント（Next.js）

1. `frontend/.env.example` を `frontend/.env.local` にコピー
2. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` に、**Maps JavaScript API** 用のキーを設定
3. `bun dev`（または `npm run dev`）で `http://localhost:3000`

### バックエンド（Bun）

1. `backend/.env.example` を `backend/.env` にコピー
2. `GOOGLE_API_KEY` に **Places API (New)** 用のキーを設定
3. `cd backend && bun run dev` → `http://localhost:8080`

検索 API はフロントから `http://localhost:8080/api/search` を叩く想定です。両方起動して動作確認してください。
