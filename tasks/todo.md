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

## 2026-09-14: iOS 版の作成（Capacitor 導入 = ToDo.md のマイルストーン 3）

方針は `docs/platform-strategy.md`（B案: Capacitor で Next.js を包む）。
appId は `com.durianmap.app` / appName は `Durian Map`（ユーザー確認済み）。
**CocoaPods は使わず Swift Package Manager で入れる**（Capacitor 8 の `--packagemanager SPM`。
このマシンの system Ruby が 2.6 で CocoaPods を入れづらいため）。

### 事前調査で分かった阻害要因
- Route Handler / middleware / サーバー側データ取得は 0 件。`/` は既に static prerender
  → `output: 'export'` の致命的な障害はない
- `next/image` の `/logo.png`（2.0MB）だけ `unoptimized` が無い → export では設定が必要
- WebView 固有の非互換: `navigator.geolocation` / `navigator.share` / `clipboard` /
  `window.location.origin`（共有URLが `capacitor://localhost` になる）
- セーフエリアがほぼ未対応（`viewport-fit=cover` 未設定 → `env()` が常に 0）
- Worker の `ALLOWED_ORIGINS` が localhost:3000 のみ → iOS から API が全滅する

### 計画
- [ ] 1. `next.config.ts` を `output: 'export'` + `images.unoptimized` に
- [ ] 2. `layout.tsx` に `viewportFit: 'cover'`、ヘッダー等に `env(safe-area-inset-*)` を適用
- [ ] 3. プラットフォーム差分を `lib/` に閉じ込める（UI から直接ネイティブ API を呼ばない）
      - `lib/platform.ts`（ネイティブ判定）
      - `lib/storage.ts` を Capacitor Preferences に差し替え
      - `lib/geolocation.ts` / `lib/share.ts` を新設し `page.tsx` の呼び出しを置換
- [ ] 4. 2.0MB のロゴを表示サイズに合わせて縮小（WebView の初回描画対策）
- [ ] 5. Capacitor 導入（`capacitor.config.ts` / `cap add ios --packagemanager SPM`）
- [ ] 6. `Info.plist` に位置情報の用途文言・表示名を設定
- [ ] 7. アイコン / スプラッシュ生成（`@capacitor/assets`）
- [ ] 8. `ALLOWED_ORIGINS` に `capacitor://localhost` を追加して Worker を再デプロイ
- [ ] 9. シミュレータで起動し、検索・地図・保存・共有・位置情報を実機確認（スクショ）
- [ ] 10. ドキュメント更新（README / platform-strategy / ToDo）とコミット

### やらないこと（今回の範囲外）
- React Native への移植（`docs/platform-strategy.md` の移行条件を満たしていない）
- Swift でのチェーン店判定の再実装（**禁止**。ロジックの正はサーバー側）
- ダークモード対応、App Store 提出作業
