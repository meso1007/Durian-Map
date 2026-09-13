# Durian Map API（Cloudflare Workers）

検索 API の実装。**チェーン店判定ロジックの唯一の正はここ**（`src/chains.ts`）。
フロントエンドや iOS 側で同じ判定を書き直さないこと → `docs/platform-strategy.md`

- 本番: https://durian-map-api.itto-hp.workers.dev
- ランタイム: Cloudflare Workers / Hono v4 / zod

## エンドポイント

### `GET /health`

疎通確認。`googleApiKeyConfigured` が `false` なら secret 未設定。

```json
{ "status": "ok", "environment": "production",
  "googleApiKeyConfigured": true,
  "chainList": { "names": 110, "domains": 56 } }
```

### `GET /api/search`

| パラメータ | 必須 | 説明 |
|---|---|---|
| `category` | ✓ | 例: `カフェ` |
| `area` | △ | エリア名検索。`lat`/`lng` がなければ必須 |
| `lat` / `lng` | △ | 現在地周辺検索。両方セットで指定 |
| `radius` | | メートル。既定 1500、上限 50000 |

`area` と `lat`/`lng` のどちらかは必須。レスポンス:

```json
{ "leads": [ { "id": "...", "name": "...", "address": "...", "category": "カフェ",
               "lat": 35.6, "lng": 139.7, "rating": 4.8, "userRatingCount": 212,
               "openNow": true, "photoName": "places/xxx/photos/yyy" } ],
  "cached": false }
```

チェーン店は除外済み。`photoName` は `/api/photo` に渡して使う。

### `GET /api/photo`

Places の写真プロキシ。**API キーをクライアントに出さないため必ずこれを経由する**。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `name` | ✓ | `places/{id}/photos/{id}` 形式 |
| `maxWidthPx` / `maxHeightPx` | | 既定 400、上限 1600 |

画像バイナリを返す。エッジキャッシュで 7 日保持。

## 仕様メモ

- **キャッシュ**: 検索結果は KV に 24 時間。座標は 4 桁（約 11m）に丸めてキー化するので、
  わずかにずれた現在地でも同じキャッシュに当たる。
  （Workers は各インスタンスが独立するため、in-memory Map では効かない）
- **レート制限**: IP あたり 60 秒 30 リクエスト。目的は Places の課金保護であって厳密な制限ではない。
  KV 障害時は fail open（サービスを止めない）。
- **CORS**: `ALLOWED_ORIGINS`（`wrangler.jsonc` の vars、カンマ区切り）のみ許可。
  **フロントを本番デプロイしたら、その URL をここに追加すること。**
- **上流タイムアウト**: 8 秒。超えたら 504 を返す。
- Places の課金ティアが上がるので `src/places.ts` の `FIELD_MASK` に安易にフィールドを足さない。

## セットアップ

```bash
bun install
```

### Google API キー

**本番（secret として設定。リポジトリには絶対に入れない）:**

```bash
bunx wrangler secret put GOOGLE_API_KEY
# → Places API (New) 用のキーを貼り付ける
```

**ローカル開発:**

```bash
cp .dev.vars.example .dev.vars   # .dev.vars は gitignore 済み
# GOOGLE_API_KEY= に値を入れる
```

## 開発・デプロイ

```bash
bun run dev        # ローカル (http://localhost:8787)
bun run typecheck  # tsc --noEmit
bun run deploy     # 本番デプロイ
bunx wrangler tail # 本番ログのライブ監視
```

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/index.ts` | Hono アプリ。ルーティング、CORS、レート制限、バリデーション |
| `src/chains.ts` | **チェーン店ブロックリストと判定ロジック（正）** |
| `src/places.ts` | Google Places API クライアント、写真取得 |
| `src/cache.ts` | KV キャッシュ |
| `src/ratelimit.ts` | KV レート制限 |
| `src/types.ts` | 型定義、Env バインディング |

## チェーン店リストの更新

`src/chains.ts` の `chainCafeNames` / `chainCafeDomains` に追記して `bun run deploy`。
店名は部分一致・小文字化して比較するので、表記ゆれ（カタカナ / 英語）は両方入れる。
