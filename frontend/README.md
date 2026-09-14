# Durian Map — フロントエンド（Web / iOS 共通）

Next.js 16（App Router）。**Web と iOS は同じこのコードベースから作る。**
iOS は Capacitor で静的書き出し（`out/`）を WebView に載せたもの。
方針は [../docs/platform-strategy.md](../docs/platform-strategy.md)、
UI を触る前に [../docs/design.md](../docs/design.md) を読むこと。

## セットアップ

```bash
bun install
cp .env.example .env.local   # 値を埋める
bun run dev                  # http://localhost:3000
```

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 地図表示（Maps JavaScript API） |
| `NEXT_PUBLIC_API_BASE_URL` | 検索 API。ローカルは `http://localhost:8787` |
| `NEXT_PUBLIC_WEB_BASE_URL` | 共有 URL の土台。未設定なら Google マップの URL を共有する |

`.env.local` は gitignore 済み。**Places のキーはここに入れない**（写真は Worker の
`/api/photo` 経由）。

## 構成のきまり

- **API 呼び出しは `src/lib/api.ts` を通す。** UI から直接 `fetch` しない。
- **永続化は `src/lib/storage.ts` を通す。** UI から `localStorage` を直接呼ばない
  （iOS では Capacitor Preferences に差し替わる）。
- **現在地は `src/lib/geolocation.ts`、共有は `src/lib/share.ts` を通す。**
  UI から `navigator.geolocation` / `navigator.share` を直接呼ばない。
- プラットフォーム判定は `src/lib/platform.ts` の `isNativePlatform()` だけを使う。
  **分岐してよいのは「Web に無い機能の代替」だけで、デザインは分岐させない。**

## iOS（Capacitor）

必要なもの: Xcode（26 系で確認）。**CocoaPods は不要** — 依存は Swift Package Manager。

```bash
bun run build:ios   # next build（静的書き出し）→ cap sync ios
bun run ios         # Xcode で開く（実機/シミュレータで実行）
```

`build:ios` は `NEXT_PUBLIC_API_BASE_URL` を本番の Workers に固定してビルドする
（上書きしたいときは環境変数で渡す）。`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` は
`.env.local` から読むので、iOS 向けにビルドする端末にも `.env.local` が要る。

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

`public/logo.png`（1024×1024）を元に生成する。素材を差し替えたら:

```bash
bun run ios:assets   # @capacitor/assets で ios/App/App/Assets.xcassets を再生成
```

> `@capacitor/assets` は sharp に依存する。`package.json` の `ignoreScripts` に
> sharp が入っているため、`bun install` 直後はネイティブバイナリが無くて失敗する。
> その場合は `cd node_modules/sharp && node install/libvips.js && node install/dll-copy.js`
> を一度だけ実行する。

### iOS 側で気をつけること

- WebView の Origin は `capacitor://localhost`。**Worker の `ALLOWED_ORIGINS` に
  これが入っていないと API が全部 CORS で落ちる**（`backend/wrangler.jsonc`）。
- 位置情報の用途文言は `ios/App/App/Info.plist` の
  `NSLocationWhenInUseUsageDescription`。
- `output: 'export'` のため `next start` は使えない。`out/` を静的配信する。
