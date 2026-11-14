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
| iOS アプリ（ネイティブ） | SwiftUI / MapKit / iOS 26 以降（Liquid Glass）。`xcodegen` でプロジェクトを生成 | `ios-native/` | ローカルビルドのみ |
| iOS アプリ（旧・Capacitor） | Capacitor 8（Web の静的書き出しを WebView に同梱）。ネイティブ版が置き換える | `frontend/ios/` | ローカルビルドのみ |
| 外部 API | Google Places API (New) / Maps JavaScript API | — | — |
| 永続化 | 端末内のみ（Web: localStorage / iOS: Capacitor Preferences）。DB なし | — | — |

パッケージマネージャ・ランタイムは **Bun**。

**iOS は 2026-11-14 からネイティブ（Swift）で別実装している**（`ios-native/`）。それまでの方針「iOS は Web と同じコードから作る」は
ユーザーの判断で変えた。API は 1 つのままで、チェーン店の判定・検索・写真はすべて Worker が持つ。
表示の規則（住所や営業時間の整形、共有リンクの形式、AI に渡すプロンプト）は `frontend/src/lib/` と `ios-native/DurianMap/Core.swift` の
両方にあるので、**片方を変えたらもう片方も直す**。

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
| `app/page.tsx` | 画面の骨格。全面の地図の上に検索バーと本体（シート / パネル）を浮かせる。状態は hooks に分けてある（状態ライブラリなし） |
| `app/components/Panel.tsx` | 本体の中身。初回表示（`Welcome`）/ 一覧（`ListHeader` + `CafeList`）/ 詳細（`CafeDetail`）のどれか 1 つ |
| `app/components/Sheet.tsx` | 本体の面。モバイルは 3 段階のボトムシート、PC は左のパネル。位置は `globals.css` の `.dm-sheet` |
| `app/components/MapView.tsx` | 地図。`@vis.gl/react-google-maps` + `@googlemaps/markerclusterer`。出せないときは `MapFallback` |
| `app/components/map/` | 地図の見た目。`mapStyle.ts`（地図の色・ピンの SVG）と `pinStyle.ts`（ピンの色） |
| `hooks/` | 検索・絞り込み・保存・選択・現在地・URL 同期・シートのドラッグ・地図のピンと視点 |
| `lib/layout.ts` / `lib/sheet.ts` | 画面の寸法と「地図のどこが UI に覆われているか」、シートの段の計算 |
| `lib/cafe.ts` / `lib/geo.ts` | Places の値を表示用に直す純関数（住所・営業時間・価格帯・距離） |
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
- **地図に重ねる面を足したら `lib/layout.ts` の `getMapInsets()` を見直す**。地図は全面に敷いてあり、
  視点の寄せ方・Google のロゴの位置・再検索の半径がすべてこの値で決まる。CSS 側の幅や高さ
  （`page.tsx` の `md:w-[416px]`、`globals.css` の `.dm-sheet`）とそろっていないと、選んだ店がパネルの下に入る
- 写真のサイズは一覧 200 / 詳細 800 の 2 種類だけ（サイズごとに別キャッシュになり、Places の写真課金が増える）
- 本番ビルドの `NEXT_PUBLIC_*` は `package.json` の `build:prod` で明示指定する（`.env.local` が優先されて localhost が焼き込まれるのを防ぐ）

## ネイティブ iOS（`ios-native/`）

| ファイル | 役割 |
|---|---|
| `project.yml` | `xcodegen generate` で `DurianMap.xcodeproj` を作る（生成物はコミットしない） |
| `DurianMap/Core.swift` | モデル・API・表示用の整形・共有 / AI のプロンプト・現在地・画面の状態（`AppModel`） |
| `DurianMap/Views.swift` | 全面の地図 + 検索バー + 標準のシート（一覧・初回表示） |
| `DurianMap/Detail.swift` | 詳細と、時計の文字盤の営業時間 |

- ガラスは OS 標準の部品（シート・`.buttonStyle(.glass)`・`.glassEffect`）に任せる。自前で半透明やぼかしを再現しない
- 保存は UserDefaults の `CapacitorStorage.saved_cafes`。Capacitor 版と同じキー・同じ JSON なので、上書きインストールで引き継がれる
- **地図は MapKit。Google Places のデータを Google 以外の地図に載せるのは Google の規約に反する**ので、
  App Store に出す前に Google Maps SDK へ替えるか、データの取得元を替えること（2026-11-14 にユーザーが承知のうえで選択）
- ビルド: `cd ios-native && xcodegen generate && xcodebuild -scheme DurianMap -destination 'id=<端末>' -allowProvisioningUpdates DEVELOPMENT_TEAM=<チーム ID> build`

## 検証

変更後は最低限これを通す:

```bash
cd backend  && bun run typecheck && bun run test
cd frontend && bun run typecheck && bun run lint && bun run test && bun run build:prod
cd frontend && bun run build:ios   # iOS を触ったとき（Xcode が要る）
```

## 既知の状態

- API は Cloudflare Workers、フロントは Cloudflare Pages にデプロイ済み。iOS はシミュレータで確認済み、App Store 未提出
- iOS 配布前に必要: `capacitor://` にはリファラー制限が効かないので **iOS 用の地図キー**を別に作る
