# Durian Map - ToDo

最終更新: 2026-09-15

作業前に読むもの: [README.md](README.md) / [docs/platform-strategy.md](docs/platform-strategy.md) /
[docs/design.md](docs/design.md)（UI を触るなら必読）

---

## 完了したマイルストーン: iOS 対応（Capacitor）

方針は `docs/platform-strategy.md`。**ロジック（API）は 1 つ、UI だけ 2 つ。**

- [x] **1. API を独立したエンドポイントに切り出す**
      Cloudflare Workers にデプロイ済み → https://durian-map-api.dailyreading.workers.dev
      Next.js の `/api/search` は削除し Workers に一本化
- [x] **2. localStorage を抽象化する**
      `frontend/src/lib/storage.ts`。UI 層からの直呼びは 0 件
- [x] **3. Next.js の静的書き出し（`output: 'export'`）**
      Cloudflare Pages への移行と同時に完了。`frontend/next.config.ts`。
      サーバー機能は元から不使用で、詰まったのは画像最適化のみ（`images.unoptimized`）
- [x] **4. Capacitor 導入**（2026-09-14）
      `frontend/capacitor.config.ts` / `frontend/ios/`。ビルドは `bun run build:ios`。
      依存は **SPM**（CocoaPods 不要）。詳細は `frontend/README.md`

## 次のマイルストーン: iOS の配布

- [ ] **Google Cloud で iOS 用の地図キーを作る** ← 先にこれ
      `capacitor://` には HTTP リファラー制限が効かない。Maps JavaScript API だけに
      絞った専用キーを作り、1 日の割当上限を設定して `.env.local` を切り替える
- [ ] **実機での確認**（シミュレータでは確認済み）
      位置情報の許可ダイアログ、共有シート、保存の永続化（アプリ再起動後）
- [ ] **App Store 提出の準備**
      Apple Developer の署名設定、スクリーンショット、プライバシー情報
      （収集データ: 位置情報 — 端末内のみで使用し送信しない、を申告）

---

## 優先度：高

- [x] **同じ Worker を複数ワークツリーからデプロイしている** → 2026-09-15 に
      `GaloisExtension/iOS` を `feat/review-2026-09-15` に統合。以後は 1 ブランチ + PR で運用する
- [ ] **Pages のプレビューデプロイが CORS で弾かれる**
      `backend/src/index.ts` の許可オリジン判定は**完全一致**なので、
      `https://<hash>.durian-map.pages.dev` からは検索できない。動作確認は本番 URL で行う。
      必要になったら `.durian-map.pages.dev` のサフィックス一致を足す
- [x] **フォント配信が重い** → `preload: false` + ウェイト 400/500/700 に絞り、
      `<link rel="preload">` 362 → 4 本。`static/media` の 5.8MB は unicode-range で必要分のみ取得。
      Capacitor 同梱サイズを減らしたければ日本語サブセット化（P1）
- [ ] **Google Cloud Console の API キー制限**
      - 地図用キー（`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`）に HTTP リファラー制限
      - Places 用キー（Worker の secret）に API 制限
      - 2 つのキーは分けて管理する
- [ ] **旧 Cloudflare アカウントの後片付け**（ユーザー対応中）
      `cinqfleurs.dev@gmail.com` 側に Worker `durian-map-api` と KV `CACHE`
      (`6c8042ead3794ef0bee3f3433a56fbb7`) が残っている

## 優先度：中

- [ ] **チェーン店リストのメンテナンス**
      `backend/src/chains.ts` の `chainCafeNames` / `chainCafeDomains` に追記して
      `bun run deploy`。店名は部分一致・小文字化で比較するので、カタカナと英語の
      表記ゆれは両方入れる（現在 names 110 / domains 56）
- [ ] **検索エリア入力のオートコンプリート**（Autocomplete はセッション課金で $0。`docs/review-2026-09-15.md` P1）
- [ ] **並び替え（評価順）**（近い順は実装済み）
- [ ] **半径セレクタ UI / 初回オンボーディング**（デザインモック `designs/durian-map-ios.pen` にあり）
- [ ] **Service Worker（Web のみ）**: App Shell + 保存一覧のオフライン表示。App Store 4.2 対策にも効く
- [ ] **`google.maps.Marker` → `AdvancedMarker` + `mapId`**（地図スタイルのクラウド移行と同時）
- [ ] **保存カフェの並び替え（保存順 / 名前順）**
      現在は「近い順」のみ（現在地があるとき）。`savedAt` を持つようにしたので
      保存順は実装できる

## 優先度：低

- [x] **自動テストの導入** → backend に vitest（6 ファイル / 92 件）。フロントは未導入
- [ ] **フロントのテスト**（hooks の単体テスト。`useCafeSearch` の競合・`useSearchUrlState` の往復から）
- [ ] **写真の複数枚対応**
      現在は `photos[0]` のみ取得。増やすと Places の課金ティアに影響するので要検討
- [ ] **クチコミの表示**
      デザイン案にはあるが `FIELD_MASK` に含めていない（課金ティアが上がる）

---

## 完了済み（2026-09-15）

総合レビュー `docs/review-2026-09-15.md` の P0 をすべて実装し本番へデプロイ。

- [x] `GaloisExtension/iOS` を統合（Capacitor iOS / 静的書き出し / Pages）
- [x] レート制限を Workers Rate Limiting binding に（KV 書き込み枯渇のカスケード解消）
- [x] `category` 列挙化・`area` 正規化・半径 snap・座標 3 桁丸め・SHA-256 キャッシュキー
- [x] 写真 URL の HMAC 署名（`PHOTO_SIGNING_KEY`）・サイズ列挙・KV 30 日キャッシュ
- [x] `periods` から営業状態と `closesAt` / `opensAt` をサーバー計算。検索 TTL 7 日
- [x] 日次予算ブレーカ（検索 300 / 写真 3,000）と Places 429 の伝播
- [x] チェーン判定の NFKC 正規化・ホスト名判定・ローマ字補完（誤除外 / 素通りを修正）
- [x] `/api/reverse-geocode`（Nominatim を Worker から）
- [x] フォント preload 362 → 4、`page.tsx` 1,383 → 146 行（hooks 9 / components 16）
- [x] URL を状態の正に（現在地検索の共有・リロード復元）、「このエリアで再検索」
- [x] a11y（h1 / フォーカス管理 / tablist / aria-live / focus-visible / maximumScale 削除）
- [x] カードに「21:00まで / 8:00から」と徒歩分
- [x] デザインモック `designs/durian-map-ios.pen` / `designs/durian-map-web.pen`

## 完了済み（2026-09-13〜14）

- [x] 方針とデザイン規約のドキュメント化（`docs/platform-strategy.md` / `docs/design.md`）
- [x] 検索 API を Cloudflare Workers（Hono）に移行しデプロイ
- [x] キャッシュを KV 化（in-memory Map は Workers では実質効いていなかった）
- [x] 写真プロキシ `/api/photo` を追加し、クライアントへの API キー露出を解消
- [x] zod によるバリデーション / レート制限 / CORS ホワイトリスト / 上流タイムアウト
- [x] UI をデザイン案に沿って刷新（グラデーション全廃・ダミータグの排除）
- [x] Co Headline の導入（woff2 変換）と数値への適用
- [x] 地図スタイルをデザイントークンの南国ライトへ
- [x] バッジのコントラスト比を 4.5:1 以上に修正（営業中 5.51 / 準備中 5.44）
- [x] `lib/api.ts` / `lib/storage.ts` による接続・永続化レイヤーの分離
- [x] フロントを静的書き出し化し Cloudflare Pages にデプロイ（https://durian-map.pages.dev）
- [x] `ALLOWED_ORIGINS` に本番 URL を追加して Worker を再デプロイ
- [x] ロゴを 2.0MB → 61KB / 365KB にリサイズ（画像最適化を無効にしたため）
- [x] 未使用依存（leaflet 系）と create-next-app 残骸の SVG を削除
- [x] モバイル UI を `.pen` に寄せて作り直し（検索をヘッダーへ / シートはリスト専用 / 下部タブバー）
- [x] ロゴを `.pen` からベクタ化（`designs/pen-logo-to-svg.py` → `logo.svg` / PWA アイコン）
- [x] 営業時間・電話番号を追加（課金ティアは据え置き）
- [x] 営業状態をカード枠線と地図ピンの枠で表現
- [x] 距離表示と「近い順」並び替え（現在地があるときのみ）
- [x] 刷新されたブランドマーク（断面が "D" のドリアン）を `.pen` からベクタ化
- [x] 絞り込みチップ（営業中 / 価格帯 3 段）を実装し `priceLevel` を追加
- [x] 「行きたい / 訪問済み」と保存画面のセグメンテッドコントロール
- [x] カードを新デザインへ（営業中バッジ廃止 → 開店時刻・訪問済みバッジ）

> 旧 ToDo にあった「バックエンド: Render (render.yaml)」は廃止。
> サーバーはすべて Cloudflare（API = Workers、フロント = Pages）。
