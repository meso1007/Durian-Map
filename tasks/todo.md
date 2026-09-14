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
