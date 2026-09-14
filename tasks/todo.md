# tasks/todo.md

## 2026-09-13: 体験向上施策 + 南国風デザイン案

- [x] コードベース把握（page.tsx / MapView.tsx / backend index.ts）
- [x] 改善提案書を作成 → `docs/ux-improvement-proposals.md`
- [x] Pencil で南国風デザイン案を生成 → `designs/durian-map-tropical.pen` / `.png`
- [x] 生成画像を確認し、必要なら再生成（初回は保存エラー→CLI更新＋絶対パスで再生成）
- [x] コミット

## レビュー
- 提案書: 17 の課題をコードから特定し、A〜E の 5 段階・24 施策 + ロードマップに整理
- デザイン: 検索トップ / 詳細 / 保存一覧の 3 画面（南国風・ドリアンモチーフ）
- 教訓: pen CLI は `--out` / `--export` に絶対パスを渡す（相対パスだと保存時に `Both URIs must be absolute!` で失敗）

---

## 2026-09-13〜14: iOS/Web 方針決定 → Workers 移行 → UI 刷新

### 計画
- [x] iOS と Web の作り分け方針を決め、ドキュメント化する
- [x] デザイン規約を作る（別の作業者が読んで分かる粒度で）
- [x] バックエンドを作り込んで Cloudflare Workers にデプロイ
- [x] サブエージェントで `.pen` を元に UI を作り込む
- [x] フロントを Workers API に接続し、Next.js の Route Handler を廃止
- [x] 残タスク（コントラスト・永続化の抽象化）を片付ける
- [x] ToDo を更新して PR にまとめる

### レビュー

**決めたこと**: ロジック（API）は 1 つ、UI だけ 2 つ。Web(Next.js) を正とし
iOS は Capacitor でラップする。React Native への移植は、バックグラウンド位置情報 /
オフライン地図 / カメラ連携のいずれかが実際に必要になるまで着手しない。

**移植の過程で見つかった既存の問題**:
1. 検索キャッシュの `Map` が Workers では各インスタンス独立のため実質効いていなかった → KV 化
2. 写真 URL に Google API キーを直埋めしてクライアントに露出していた → `/api/photo` プロキシ化
3. 営業中バッジのコントラスト比が 3.60:1 で基準割れ（指摘されていた準備中 3.17:1 の調査中に発見）

**教訓**（詳細は `tasks/lessons.md`）:
- `wrangler secret put` は TTY のない環境で実行すると空文字を保存して「Success」と表示する
- サブエージェントの報告は網羅的とは限らない。1 件指摘されたら同種の問題を自分で全件洗う

---

## 2026-09-14: フロントを Cloudflare Pages へ

方針: サーバーはこれから全て Cloudflare に寄せる。

### 計画
- [x] Next.js を静的書き出し（`output: 'export'`）に切り替える
- [x] `images.unoptimized` に伴うロゴ（2.0MB）のリサイズ
- [x] 本番ビルドの API ベース URL を `.env.local` に左右されない形で固定する
- [x] Cloudflare Pages プロジェクトを作成してデプロイ
- [x] `ALLOWED_ORIGINS` に本番 URL を追加して Worker を再デプロイ
- [x] 本番 URL で検索 → 地図 → 写真 → 保存 まで実機確認
- [x] ドキュメント更新（Vercel 想定 → Cloudflare Pages）

### レビュー

**結果**: https://durian-map.pages.dev で公開。ブラウザで検索 19 件 → 地図描画 →
写真（Worker プロキシ経由）→ 保存（localStorage）まで通ることを確認。コンソールの
エラーは 0 件（`google.maps.Marker` の deprecation 警告のみで、これは移行前からある）。

**静的書き出しは想定より楽だった**: サーバー機能（Route Handler / Server Actions /
`cookies()` / middleware / 動的ルート）が元から一つも無く、`useSearchParams` も
すでに Suspense 境界の内側にあった。実質のブロッカーは `next/image` の最適化だけ。

**移行の過程で見つかった既存の問題**:
1. `public/logo.png` が **2.0MB**（1024px）で、44px 表示とPWAアイコンに共用されていた。
   画像最適化サーバーが無くなると素通しで配信されるため、192/512px に分割して置き換えた
2. `leaflet` / `react-leaflet` / `@types/leaflet` が `src/` から一度も import されていない
   （Google Maps へ移行した際の残骸）。`public/` の create-next-app 製 SVG 5 個も同様
3. `next start` は `output: 'export'` では動かないのに package.json に残っていた → 削除

**未解決として ToDo に上げたもの**:
- Pages のプレビューデプロイは CORS 許可オリジンの完全一致から外れるため検索できない
- `next/font/google` の M PLUS Rounded 1c が 505 スライス（media 7.7MB / CSS 378KB）

**教訓**（詳細は `tasks/lessons.md`）:
- Cloudflare は Pages を Workers へ統合中。`wrangler pages project create` は既定で
  Workers に委譲され失敗する。従来の Pages に作るには初回だけ `--force` が要る
- 画像最適化を切るときは、`public/` の画像が実表示サイズに合っているか必ず確認する
