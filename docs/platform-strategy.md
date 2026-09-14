# プラットフォーム方針（Web / iOS）

最終更新: 2026-09-14

## 結論

**iOS アプリと Web アプリは「別々に作らない」。ロジック（API）は 1 つ、UI だけ 2 つ**にする。
当面は **Web（Next.js）を正とし、iOS は Capacitor でその Web をネイティブの殻に包む**。
React Native（Expo）でのフルネイティブ化は、後述の「C に移る条件」を満たしてから着手する。

## 現状のコードベース（2026-09-13 時点）

```
backend/                         # Cloudflare Workers（Hono）← API の正
  src/chains.ts                  # チェーン店ブロックリストと判定ロジック（正）
  src/index.ts                   # ルーティング / CORS / レート制限 / バリデーション
  src/places.ts                  # Google Places クライアント、写真取得
  src/cache.ts  src/ratelimit.ts # KV キャッシュ / レート制限
frontend/                        # Cloudflare Pages（静的書き出し）
  next.config.ts                 # output: 'export' ← Pages / Capacitor 共通の前提
  src/app/page.tsx               # 画面本体
  src/app/components/MapView.tsx # Google Maps
  src/lib/api.ts                 # Workers API クライアント（UI から直 fetch しない）
  src/lib/storage.ts             # 永続化の抽象化（UI から localStorage を直呼びしない）
  public/manifest.json           # PWA マニフェスト（導入済み）
designs/durian-map-tropical.pen  # デザイン案（.pen）
docs/design.md                   # デザイン規約 ← UI を触る人はこれを読む
docs/design-tokens.md            # カラートークン（色の正）
```

**重要な前提**: チェーン店判定ロジックはすべてサーバー側（`backend/src/chains.ts`）にある。
iOS からも同じ HTTP エンドポイントを叩くだけで再利用できる。**ここを二重実装しないこと。**

## 3 つの選択肢と採用理由

| | 作り方 | 追加コスト | App Store | 判定 |
|---|---|---|---|---|
| A. PWA のみ | 今のまま。ホーム画面に追加 | ほぼ 0 | ✗ 出せない | 補助的に維持 |
| **B. Capacitor** | **Next.js を WebView でラップ** | **小（数日）** | ✓ | **← 採用** |
| C. Expo / React Native | iOS 用 UI を別途実装（ロジックは共有） | 大（UI 全書き直し） | ✓ ネイティブ品質 | 将来の選択肢 |

B を採る理由:

- このアプリの中核は「地図 + リスト + 検索」。Capacitor（WebView 内の Google Maps JS）でも実用的な体験になる。
- 966 行の `page.tsx` を今 React Native へ移植するのは、MVP 段階では明らかに過剰投資。
- A（PWA）だけでは App Store に出せない。配布チャネルを確保したい。

## いまやっておく準備（C への移行コストを下げる）

- [x] **1. API を「独立したエンドポイント」として切り出す** — 完了
      Cloudflare Workers（`backend/`）にデプロイ済み: https://durian-map-api.dailyreading.workers.dev
      Next.js の `/api/search` Route Handler は廃止し、Workers に一本化した。
      フロントは `NEXT_PUBLIC_API_BASE_URL` 経由で叩く（`frontend/src/lib/api.ts`）。
- [x] **2. localStorage 依存を抽象化する** — 完了
      `frontend/src/lib/storage.ts` に集約。API は非同期にしてあるので、実体を
      Capacitor Preferences やサーバー保存に差し替えても UI 側の修正は不要。
      **UI コンポーネントから `localStorage` を直接呼ばないこと。**
- [x] **3. 静的書き出しの検証** — 完了
      `output: 'export'` でビルドが通ることを確認済み（`frontend/next.config.ts`）。
      サーバー機能は元から不使用、`useSearchParams` も Suspense 境界の内側にあった。
      画像最適化だけ `images.unoptimized` で無効化している。
- [x] **4. Capacitor 導入** — 完了（2026-09-14）
      `frontend/capacitor.config.ts` / `frontend/ios/`。手順は `frontend/README.md`。
      - appId `com.durianmap.app` / appName `Durian Map`
      - **依存は CocoaPods ではなく Swift Package Manager**
        （`cap add ios --packagemanager SPM`）。CocoaPods は入れなくてよい
      - `bun run build:ios` で静的書き出し〜 iOS プロジェクトへの同期まで走る
      - プラットフォーム差分は `lib/` に閉じ込めた（下記）

## プラットフォーム差分の置き場所

Web と iOS で実体が変わるものは、すべて `frontend/src/lib/` の中に閉じ込める。
**UI コンポーネントから Capacitor のプラグインを直接 import しないこと。**

| モジュール | Web | iOS |
|---|---|---|
| `lib/platform.ts` | `isNativePlatform()` が false | true |
| `lib/storage.ts` | localStorage | Capacitor Preferences |
| `lib/geolocation.ts` | `navigator.geolocation` / `navigator.permissions` | Capacitor Geolocation（`checkPermissions()`） |
| `lib/share.ts` | Web Share API / クリップボード | ネイティブ共有シート |
| `lib/api.ts` | 同じ Worker を叩く（差分なし） | 同左 |

分岐してよいのは「Web に無い機能の代替」だけ。**見た目は分岐させない**（`docs/design.md` 6節）。

### 権限は「聞く前に確認する」

`lib/geolocation.ts` の `hasGrantedPermission()` は、**すでに許可されているか**だけを
調べる（Web は Permissions API、iOS は Capacitor の `checkPermissions()`。
判定できない環境では false に倒す）。

起動直後の暗黙の現在地取得はこれが true のときだけ走らせる。未許可の状態で
`getCurrentPosition()` を呼ぶと、アプリの説明を読む前に OS のダイアログが出て
拒否されやすく、**一度拒否されると「近くからさがす」が永久に効かなくなる**。
iOS はブラウザと違い、拒否の取り消しが「設定」アプリの中にしかないので影響が大きい。

### 第三者 API をブラウザから直接叩かない

逆ジオコード（Nominatim）は **Worker の `/api/reverse-geocode` 経由**にする。
ブラウザからは User-Agent を付けられず利用規約を満たせない上、ユーザーの座標が
第三者へ直接渡ってしまう。Worker を挟めば正しい UA・キャッシュ・座標の丸めが効く。

## iOS 固有の落とし穴

- **CORS**: WebView の Origin は `capacitor://localhost`。これは環境で変わらない値なので
  `backend/src/index.ts` の `NATIVE_APP_ORIGINS` で**常に許可**している。
  `ALLOWED_ORIGINS`（環境変数）には書かないこと — 別ブランチがその行を編集して
  デプロイすると消え、iOS だけ静かに壊れる。→ tasks/lessons.md
- **共有 URL**: ネイティブでは `window.location.origin` が `capacitor://localhost` になり
  共有先で開けない。`NEXT_PUBLIC_WEB_BASE_URL`（= Pages の公開 URL）を
  `build:ios` で焼き込んでいる。
- **地図キーの制限**: `capacitor://` からのリクエストには HTTP リファラー制限が効かない。
  Maps JavaScript API はバンドル ID 制限に対応していないため、iOS 用は
  「Maps JavaScript API だけに絞った別キー + 割当上限」で守る。→ ToDo.md
- **セーフエリア**: `viewport-fit=cover` を入れたので `env(safe-area-inset-*)` が効く。
  新しく画面端に置く UI はセーフエリアを足すこと（下部タブバーは対応済み）。

## デプロイ先

| レイヤ | 環境 | URL |
|---|---|---|
| API | Cloudflare Workers（`durian-map-api`） | https://durian-map-api.dailyreading.workers.dev |
| フロント（Web） | Cloudflare Pages（`durian-map`） | https://durian-map.pages.dev |
| iOS | ローカルビルドのみ（App Store 未提出） | `frontend/ios/` |

サーバーはすべて Cloudflare に寄せる方針。フロントは `output: 'export'` の静的書き出しを
`wrangler pages deploy` で直接アップロードしている（`cd frontend && bun run deploy`）。

**許可オリジンは `backend/wrangler.jsonc` の `ALLOWED_ORIGINS`**。判定は完全一致なので、
Pages のプレビューデプロイ（`https://<hash>.durian-map.pages.dev`）は CORS で弾かれる。
本番ドメインでの確認を正とする。

> Cloudflare は Pages を Workers 側へ統合中で、`wrangler pages project create` は
> 既定で Workers へ委譲される。この `durian-map` プロジェクトは `--force` を付けて
> 従来の Pages 側に作成済み。**以降のコマンドに `--force` は不要**。

## やらないこと

- iOS 用に Swift でチェーン店判定を書き直す → **禁止**。ロジックの正はサーバー側 1 箇所。
- Web と iOS でデザイントークンを別管理する → **禁止**。`docs/design-tokens.md` が唯一の正。
- 現時点で React Native への移植を始める → 早すぎる。下記の条件を満たすまで待つ。

## C（React Native）に移る条件

次のいずれかが**実際に必要になった**時点で再検討する（「いつか使うかも」では動かない）:

- 位置情報のバックグラウンド取得（例: 近くに個人カフェがあったら通知）
- オフラインでの地図閲覧
- カメラ連携（店の写真を撮って保存）
- WebView 由来の描画・スクロール性能が体感で問題になった場合

## 作業分担のときの原則

- **サーバー側ロジック**（`api/search/route.ts`、チェーン店リスト）を触る人と、
  **UI**（`page.tsx`、`MapView.tsx`）を触る人を分けるとコンフリクトしにくい。
- UI を触る前に必ず `docs/design.md` を読むこと。
