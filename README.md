# Durian-Map

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
