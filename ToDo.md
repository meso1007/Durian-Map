# Durian Map - ToDo

最終更新: 2026-09-14

作業前に読むもの: [README.md](README.md) / [docs/platform-strategy.md](docs/platform-strategy.md) /
[docs/design.md](docs/design.md)（UI を触るなら必読）

---

## 進行中のマイルストーン: iOS 対応（Capacitor）

方針は `docs/platform-strategy.md`。**ロジック（API）は 1 つ、UI だけ 2 つ。**

- [x] **1. API を独立したエンドポイントに切り出す**
      Cloudflare Workers にデプロイ済み → https://durian-map-api.dailyreading.workers.dev
      Next.js の `/api/search` は削除し Workers に一本化
- [x] **2. localStorage を抽象化する**
      `frontend/src/lib/storage.ts`。UI 層からの直呼びは 0 件
- [x] **3. Next.js の静的書き出し（`output: 'export'`）**
      Cloudflare Pages への移行と同時に完了。`frontend/next.config.ts`。
      サーバー機能は元から不使用で、詰まったのは画像最適化のみ（`images.unoptimized`）
- [ ] **4. Capacitor 導入** ← 次はこれ
      - `@capacitor/core` / `@capacitor/ios` の導入と `npx cap add ios`
      - `webDir` は `frontend/out`（静的書き出し済み）
      - セーフエリア・スクロールの実機確認
      - App Store 用のアイコン・スプラッシュ

---

## 優先度：高

- [ ] **同じ Worker を複数ワークツリーからデプロイしている**
      `../iOS`（`GaloisExtension/iOS`）の `backend/wrangler.jsonc` も Worker 名が
      `durian-map-api` で、デプロイし合うと互いの変更が消える。実際に一度上書きされた。
      ブランチごとに検証するなら Worker 名か環境（`wrangler.jsonc` の `env`）を分ける
- [ ] **Pages のプレビューデプロイが CORS で弾かれる**
      `backend/src/index.ts` の許可オリジン判定は**完全一致**なので、
      `https://<hash>.durian-map.pages.dev` からは検索できない。動作確認は本番 URL で行う。
      必要になったら `.durian-map.pages.dev` のサフィックス一致を足す
- [ ] **フォント配信が重い**
      `next/font/google` の M PLUS Rounded 1c が 505 スライス（`out/_next/static/media` に
      7.7MB、`@font-face` 宣言だけで CSS 378KB）。ブラウザは必要な unicode-range しか
      取りに行かないが、CSS 自体はレンダーブロッキング。日本語サブセットの絞り込みを検討
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
- [ ] **検索エリア入力のオートコンプリート**
      現状はチップ（渋谷/新宿/池袋/東京）のみ
- [ ] **並び替え（近い順・評価順）**
      design.md の方針により「押せるのに効かない UI」は作らないため、
      実装とセットで入れる
- [ ] **保存カフェの状態管理（行きたい / 訪問済み）**
      デザイン案にはあるが、状態を持っていないため未実装。
      実装するなら `lib/storage.ts` のスキーマ拡張から

## 優先度：低

- [ ] **自動テストの導入**
      現在テストなし。まず `backend/src/chains.ts` の `isChainCafe()` が
      対象として分かりやすい（純粋関数・ロジックの中核）
- [ ] **写真の複数枚対応**
      現在は `photos[0]` のみ取得。増やすと Places の課金ティアに影響するので要検討
- [ ] **クチコミの表示**
      デザイン案にはあるが `FIELD_MASK` に含めていない（課金ティアが上がる）

---

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

> 旧 ToDo にあった「バックエンド: Render (render.yaml)」は廃止。
> サーバーはすべて Cloudflare（API = Workers、フロント = Pages）。
