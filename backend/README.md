# Durian Map API（Cloudflare Workers）

検索 API の実装。**チェーン店判定ロジックの唯一の正はここ**（`src/chains.ts`）。
フロントエンドや iOS 側で同じ判定を書き直さないこと → `docs/platform-strategy.md`

- 本番: https://durian-map-api.dailyreading.workers.dev
- ランタイム: Cloudflare Workers / Hono v4 / zod
- テスト: vitest（`bun run test`）

## エンドポイント

### `GET /health`

疎通確認。`*Configured` が `false` なら secret が未設定か**空**。

```json
{ "status": "ok", "environment": "production",
  "googleApiKeyConfigured": true,
  "photoSigningConfigured": true,
  "chainList": { "names": 120, "domains": 54 } }
```

### `GET /api/search`

| パラメータ | 必須 | 説明 |
|---|---|---|
| `category` | ✓ | `カフェ` のみ。他の値は 400 |
| `area` | △ | エリア名検索。NFKC 正規化 + trim して 1〜40 文字。`lat`/`lng` がなければ必須 |
| `lat` / `lng` | △ | 現在地周辺検索。両方セットで指定。3 桁（約 110m）に丸めて扱う |
| `radius` | | メートル。`500 / 1000 / 1500 / 3000 / 5000` のうち最も近い値に寄せる。既定 1500 |

`area` と `lat`/`lng` のどちらかは必須。レスポンス:

```json
{ "leads": [ { "id": "...", "name": "...", "address": "...", "category": "カフェ",
               "lat": 35.6, "lng": 139.7, "rating": 4.8, "userRatingCount": 212,
               "openNow": true, "closesAt": "21:00",
               "weekdayDescriptions": ["月曜日: 8時00分～19時00分", "..."],
               "phone": "03-0000-0000", "priceLevel": "PRICE_LEVEL_MODERATE",
               "photoName": "places/xxx/photos/yyy", "photoSig": "1d7e72…" } ],
  "cached": false }
```

チェーン店は除外済み。

| フィールド | 意味 |
|---|---|
| `openNow` | 営業中かどうか。**リクエストのたびに JST で計算する**。不明なら省略 |
| `closesAt` | 営業中のときの閉店時刻（`"21:00"`）。24 時間営業なら省略 |
| `opensAt` | 閉店中のときの次の開店時刻（`"8:00"`） |
| `photoSig` | `photoName` の署名。`/api/photo` の `sig` にそのまま渡す |

### `GET /api/photo`

Places の写真プロキシ。**API キーをクライアントに出さないため必ずこれを経由する**。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `name` | ✓ | `places/{id}/photos/{id}` 形式 |
| `sig` | ✓ | 検索レスポンスの `photoSig`。不一致は 403 |
| `maxWidthPx` / `maxHeightPx` | | `200 / 400 / 800` のうち最も近い値に寄せる。既定 400 |

画像バイナリを返す。エッジキャッシュ（`caches.default`）と KV（30 日）の 2 段。
日次の写真予算を超えているときは本文なしの 503。

### `GET /api/reverse-geocode`

座標からエリア名を引く（検索欄の入力補助）。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `lat` / `lng` | ✓ | 3 桁に丸めてから外部へ送る |

```json
{ "area": "渋谷区" }
```

見つからない・上流が落ちている場合も **200 で `{ "area": null }`**。
実体は Nominatim（OSM）。ブラウザからは利用規約で必須の User-Agent を付けられず、
ユーザーの座標を第三者に直接送ることにもなるので、必ず Worker 経由で呼ぶ。

## 仕様メモ

- **検索キャッシュ**: KV に 7 日（キー `search:v4:<sha256>`）。キーは正規化した JSON の
  SHA-256 なので、区切り文字を含む入力で衝突させられず、長い入力でも KV のキー上限
  512B を超えない。**`Lead` の形を変えたら `src/cache.ts` の `SCHEMA_VERSION` を上げる**
- **営業状態**: KV には `periods`（曜日と時刻の開閉ペア）だけを保存し、`openNow` /
  `closesAt` / `opensAt` は**レスポンスを作るたびに JST で計算**する。
  Places の `openNow` をそのまま保存すると TTL のあいだ嘘をつき続ける
- **写真キャッシュ**: KV に 30 日（キー `photo:v1:<name>:<w>x<h>`、Content-Type は
  metadata）。写真は費用の 9 割を占める（1 枚 $0.007・無料枠は月 1,000 枚）ので、
  ここのヒット率がそのまま請求額になる。Places の規約上キャッシュは 30 日まで
- **レート制限**: Workers の **Rate Limiting binding**（`wrangler.jsonc` の `ratelimits`）。
  検索系 30/分・写真 300/分。キーは `cf-connecting-ip`（IPv6 は /64 に丸める）、
  無ければ `cf-ray`。どちらも無ければ素通し（固定キーに寄せると全員が同じ枠を共有して
  しまうため）。**KV は使わない** — 以前の KV 実装は無料枠 1,000 writes/日を
  約 50 検索で使い切り、枯渇するとレート制限とキャッシュが同時に死んでいた
- **予算ブレーカ**: Places を実際に呼ぶ直前に KV カウンタ
  `budget:<JST の YYYYMMDD>:search|photo` を見て、`wrangler.jsonc` の
  `DAILY_SEARCH_BUDGET` / `DAILY_PHOTO_BUDGET` 以上なら 503。
  レート制限は 1 クライアントあたりの制限なので、分散して叩かれると効かない。
  想定外の請求はこちらで機械的に止める。KV 障害時は fail open
- **CORS**: `ALLOWED_ORIGINS`（`wrangler.jsonc` の vars、カンマ区切り）のみ許可。
  ただし **CORS はブラウザからの誤用を防ぐだけで、濫用対策ではない**。
  curl やスクリプトは Origin を自由に付けられるし、Hono の `cors()` は拒否した
  Origin でもハンドラ自体は実行する。課金を守っているのはレート制限・写真の署名・
  予算ブレーカであって CORS ではない
- **上流タイムアウト**: 8 秒。超えたら 504。Places が 429 を返したら 429 +
  `Retry-After: 30` をそのまま返す（潰すとフロントがバックオフできない）
- **リクエスト ID**: `cf-ray`（無ければ UUID）を全ログとエラーレスポンスの
  `requestId` に載せる。ログに出すユーザー入力は 64 文字で切って制御文字を除去する
- Places の課金ティアが上がるので `src/places.ts` の `FIELD_MASK` に安易に
  フィールドを足さない（`regularOpeningHours` は periods 込みで 1 フィールド）

## セットアップ

```bash
bun install
```

### secret（2 つ）

**本番（リポジトリには絶対に入れない）:**

```bash
bunx wrangler secret put GOOGLE_API_KEY     # Places API (New) 用のキー
bunx wrangler secret put PHOTO_SIGNING_KEY  # openssl rand -hex 32 で生成した値
```

> ⚠️ **このコマンドは対話プロンプトを使うので、必ず普通のターミナルから実行すること。**
> TTY のない環境（CI、エディタ統合のシェル、`!` プレフィックス経由など）で実行すると、
> プロンプトが EOF を読んで**空文字の secret が保存される**。secret 自体は存在するのに
> 値が空、という気づきにくい状態になる（`✨ Success!` とも表示される）。
>
> TTY がない環境でどうしても設定するなら、ファイル経由で渡す:
> ```bash
> openssl rand -hex 32 > /tmp/photo-key.txt
> bunx wrangler secret put PHOTO_SIGNING_KEY < /tmp/photo-key.txt
> rm /tmp/photo-key.txt
> ```
>
> 設定後は必ず `/health` の `googleApiKeyConfigured` と `photoSigningConfigured` が
> **両方 `true`** になったか確認する。`false` のままなら値が空なので設定し直す。

`PHOTO_SIGNING_KEY` は `/api/photo` の署名検証に使う。
**未設定だと `/api/photo` は 500 を返し、写真が 1 枚も出ない**（署名を検証できないため）。
デプロイの前に設定しておくこと。鍵を変えると、変更前に配った `photoSig` は無効になる
（フロントが次の検索をすれば直る）。

**ローカル開発:**

```bash
cp .dev.vars.example .dev.vars   # .dev.vars は gitignore 済み
# GOOGLE_API_KEY= と PHOTO_SIGNING_KEY= に値を入れる
```

`.env` は使わない（値の置き場所が 2 つあると片方だけ古くなる）。`.gitignore` 済み。

## 開発・デプロイ

```bash
bun run dev        # ローカル (http://localhost:8787)
bun run typecheck  # tsc --noEmit
bun run test       # vitest run
bun run deploy     # 本番デプロイ
bunx wrangler tail # 本番ログのライブ監視
```

デプロイ後は `wrangler deployments list` で**自分の Version ID が最新か**を確認する
（同じ Worker 名を複数のワークツリーからデプロイすると互いに上書きする → `tasks/lessons.md`）。

`Env` に binding を足したら `bun run cf-typegen`（`wrangler types`）で型を更新できる。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/index.ts` | Hono アプリ。ルーティング、CORS、レート制限、バリデーション |
| `src/chains.ts` | **チェーン店ブロックリストと判定ロジック（正）** |
| `src/places.ts` | Google Places API クライアント（`callPlacesApi` に集約）、写真取得 |
| `src/cache.ts` | 検索結果の KV キャッシュとキー生成 |
| `src/photo.ts` | 写真 URL の署名・検証、サイズの正規化 |
| `src/opening-hours.ts` | `periods` から JST で営業状態を計算 |
| `src/budget.ts` | 日次予算カウンタ |
| `src/reverse-geocode.ts` | Nominatim 経由の逆ジオコード |
| `src/ratelimit.ts` | レート制限のキー決定（実体は binding） |
| `src/types.ts` | 型定義、Env バインディング |
| `src/*.test.ts` | vitest。KV や fetch に依存しない純関数を固定する |

## チェーン店リストの更新

`src/chains.ts` の `chainCafeNames` / `chainCafeDomains` に追記して `bun run deploy`。

- 店名は NFKC + 小文字化して比較する。表記ゆれ（カタカナ / ローマ字）は両方入れる
- 短い ASCII 語（6 文字以下）は語境界を要求する。`kfc` が `KFCafe` に当たらないようにするため
- ドメインは**ホスト名の完全一致かサブドメイン一致**。持株会社のドメインは
  個店サイトに現れず誤検知しか生まないので入れない
- **誤除外（個人店が消える）のほうが取りこぼしより重い**。追加したら
  `src/chains.test.ts` に固定例を足して `bun run test` を通す
