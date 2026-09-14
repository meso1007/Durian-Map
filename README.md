# Durian-Map

スタバもドトールも飽きたあなたへ。個人経営の小さなカフェを見つけるマップ。

## ドキュメント（作業前に読む）

| ファイル | 内容 |
|---|---|
| [docs/platform-strategy.md](docs/platform-strategy.md) | Web / iOS の方針（結論: API 1 つ・UI 2 つ、iOS は Capacitor） |
| [docs/design.md](docs/design.md) | **デザイン規約。UI を触る前に必読**（グラデーション禁止・タグの扱い・フォント） |
| [docs/design-tokens.md](docs/design-tokens.md) | カラートークン（色の正） |
| [backend/README.md](backend/README.md) | API 仕様・デプロイ手順 |
| [frontend/README.md](frontend/README.md) | Web / iOS のビルド手順とレイヤ構成のきまり |

## 構成

| レイヤ | 技術 | 場所 | デプロイ先 |
|---|---|---|---|
| API | Cloudflare Workers / Hono | `backend/` | https://durian-map-api.dailyreading.workers.dev |
| フロント（Web） | Next.js 16 / React 19 / Tailwind v4（静的書き出し） | `frontend/` | https://durian-map.pages.dev |
| iOS アプリ | Capacitor 8（WebView） | `frontend/ios/` | ローカルビルドのみ |

**iOS は Web と同じコードから作る**（`frontend/` の静的書き出しを WebView に載せている）。
iOS 用に UI を別実装しないこと。

チェーン店判定ロジックの正は `backend/src/chains.ts`。フロントや iOS 側で書き直さないこと。

## セットアップ

### バックエンド（Cloudflare Workers）

```bash
cd backend
bun install
cp .dev.vars.example .dev.vars   # GOOGLE_API_KEY / PHOTO_SIGNING_KEY を入れる
bun run dev                      # http://localhost:8787
bun run test                     # vitest
```

本番の secret は 2 つ。どちらもリポジトリには入れない:

```bash
cd backend
bunx wrangler secret put GOOGLE_API_KEY     # Places API (New) のキー
bunx wrangler secret put PHOTO_SIGNING_KEY  # openssl rand -hex 32 で生成した値
```

`PHOTO_SIGNING_KEY` は `/api/photo` の署名検証に使う。**未設定だと写真が 1 枚も出ない**ので
デプロイ前に設定し、`/health` の `googleApiKeyConfigured` と `photoSigningConfigured` が
両方 `true` になることを確認する（TTY の無い環境で `wrangler secret put` を実行すると
空の値が保存される → `tasks/lessons.md`）。

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

### iOS アプリ（Capacitor）

Xcode が要る。**CocoaPods は不要**（依存は Swift Package Manager）。

```bash
cd frontend
bun run build:ios   # 静的書き出し → iOS プロジェクトへ同期
bun run ios         # Xcode で開いて実行
```

詳細・注意点は [frontend/README.md](frontend/README.md)。

## 注意

- API キーは**地図用とPlaces用で分ける**（Google Console で制限を分けやすい）
- フロントを本番デプロイしたら、その URL を `backend/wrangler.jsonc` の `ALLOWED_ORIGINS` に追加して再デプロイする
- iOS アプリの Origin は `capacitor://localhost`。これは `backend/src/index.ts` の
  `NATIVE_APP_ORIGINS` で常に許可している（環境変数に置くと、別ブランチのデプロイで消える）
- **`ALLOWED_ORIGINS`（CORS）は濫用対策ではない。** ブラウザからの誤用を防ぐだけで、
  curl やスクリプトは Origin を自由に付けられる。課金を守っているのは
  レート制限・写真の HMAC 署名・日次予算ブレーカ（→ [backend/README.md](backend/README.md)）
