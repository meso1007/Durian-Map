# frontend — Durian Map

Next.js 16 / React 19 / Tailwind CSS v4。**静的書き出し（`output: 'export'`）**で
Cloudflare Pages に配信し、**同じ成果物を Capacitor が iOS の WebView に載せる**。
UI を触る前に [`docs/design.md`](../docs/design.md) を読むこと。
Web / iOS の作り分け方針は [`docs/platform-strategy.md`](../docs/platform-strategy.md)。

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
| `NEXT_PUBLIC_WEB_BASE_URL` | 共有 URL の土台（iOS 専用。Web では `location.origin` を使う） |

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
| `bun run build:ios` | 本番ビルド → iOS プロジェクトへ同期（`cap sync`） |
| `bun run ios` | Xcode で iOS プロジェクトを開く |
| `bun run ios:assets` | `.pen` 由来の SVG から iOS のアイコン / スプラッシュを再生成 |
| `bun run lint` | ESLint |

`next start` は無い。静的書き出しにサーバーは存在しないため。

## デプロイ

```bash
bun run deploy   # → https://durian-map.pages.dev
```

フロントの URL を変えたら **`backend/wrangler.jsonc` の `ALLOWED_ORIGINS` に追加して
`cd ../backend && bun run deploy`** すること。忘れると本番で CORS に弾かれる。

## 構成のきまり

実体が Web と iOS で変わるものは `src/lib/` に閉じ込める。**UI コンポーネントから
直接呼ばないこと**（iOS で差し替えられなくなる）。

| やりたいこと | 使うもの | 直接呼ばない |
|---|---|---|
| 検索・写真 URL | `lib/api.ts` | `fetch` |
| 保存済みカフェ | `lib/storage.ts` | `localStorage` |
| 現在地 | `lib/geolocation.ts` | `navigator.geolocation` |
| 共有 | `lib/share.ts` | `navigator.share` / `clipboard` / `alert` |
| 実行環境の判定 | `lib/platform.ts` | `Capacitor` の直 import |

**分岐してよいのは「Web に無い機能の代替」だけで、デザインは分岐させない。**

## iOS（Capacitor）

必要なもの: Xcode（26 系で確認）。**CocoaPods は不要** — 依存は Swift Package Manager。

```bash
bun run build:ios   # 本番ビルド（静的書き出し）→ cap sync ios
bun run ios         # Xcode で開く（実機/シミュレータで実行）
```

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` は `.env.local` から読むので、iOS 向けに
ビルドする端末にも `.env.local` が要る。

シミュレータへコマンドラインで入れる場合:

```bash
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.durianmap.app
```

### アイコン / スプラッシュ

素材の正は `designs/durian-map-tropical.pen`。`.pen` を直したら
`designs/pen-frame-to-svg.py` で SVG を起こし直し、`bun run ios:assets` を流す。

`scripts/gen-ios-assets.mjs` が **変種を使い分けている**（docs/design-tokens.md）:

| 用途 | 元 | 理由 |
|---|---|---|
| アプリアイコン | `src/app/icon.svg`（App Icon フレーム） | 角丸は iOS が付けるので `rx` を落とし、アルファを潰して全面ベタにする（透明が残ると審査で弾かれる） |
| スプラッシュ | `public/logo-light.svg`（Light 変種） | 地がクリームなので濃緑のマークを使う。Dark 変種は淡色マークで**クリーム地では見えない** |

> sharp は `package.json` の `ignoreScripts` に入っているため、`bun install` 直後は
> ネイティブバイナリが無くて失敗する。その場合は
> `cd node_modules/sharp && node install/libvips.js && node install/dll-copy.js`
> を一度だけ実行する。

### iOS 側で気をつけること

- WebView の Origin は `capacitor://localhost`。**Worker の `ALLOWED_ORIGINS` に
  これが入っていないと API が全部 CORS で落ちる**（`backend/wrangler.jsonc`）。
- 位置情報の用途文言は `ios/App/App/Info.plist` の
  `NSLocationWhenInUseUsageDescription`。
- 画面端に UI を足すときは `env(safe-area-inset-*)` を見込む。

## 制約メモ

- 画像最適化は無効（`images.unoptimized`）。最適化サーバーが無いので、`public/` に置く
  画像は**あらかじめ表示サイズに合わせて用意する**。
- Pages のプレビューデプロイ（`https://<hash>.durian-map.pages.dev`）は API の
  許可オリジンに入っていないため、検索が CORS で失敗する。確認は本番 URL で行う。
