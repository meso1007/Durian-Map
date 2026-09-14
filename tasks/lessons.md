# tasks/lessons.md

- pen CLI（@pen.dev/cli）は `--out` / `--export` / `--prompt-file` に**絶対パス**を渡す。相対パスだと生成完了後の保存で `IPCError: Both URIs must be absolute!` となり、数分の生成結果が失われる。

## 2026-09-14: Cloudflare / 検証まわり

### `wrangler secret put` は TTY がないと空の値を保存する

`!` プレフィックス経由やCI など対話プロンプトを持たない環境で実行すると、
プロンプトが EOF を読んで**空文字の secret を保存し、しかも `✨ Success!` と表示する**。
`wrangler secret list` にも載るため、存在チェックだけでは検知できない。

**ルール**:
- secret 設定後は必ずアプリ側のヘルスチェックで**値が空でないこと**まで確認する
- 存在チェック（`Boolean(env.X)`）ではなく `trim().length > 0` で判定する
- 対話プロンプトが要るコマンドは、ユーザー自身の通常ターミナルで実行してもらう

### アカウントが切り替わるとリソース ID が無効になる

`wrangler login` し直すと別アカウントになり、`wrangler.jsonc` に書いた
KV namespace ID は無効になる（デプロイは通るがバインドが壊れる）。
workers.dev のサブドメインも変わるので URL の総置換が必要。

**ルール**: デプロイ後は `wrangler whoami` でアカウントを確認し、
`wrangler deploy` の出力の Bindings 一覧にリソースが正しく並んでいるか見る。

### 指摘が 1 件でも、同種の問題は全件洗う

「準備中バッジのコントラストが低い」という 1 件の報告から調べたところ、
営業中バッジ（3.60:1）と保存ボタン（3.65:1）にも同じ問題があった。
根本原因は「淡色地に載せる文字に `-500` 系をそのまま使っていた」という共通パターン。

**ルール**: 報告された 1 件を直す前に、**同じ原因で起きうる箇所を機械的に全部列挙する**。
サブエージェントの報告は網羅的とは限らない。

## 2026-09-14: Cloudflare Pages / 静的書き出し

### Cloudflare Pages は Workers へ統合中。初回作成だけ `--force` が要る

`wrangler pages project create <name>` は既定で「最新版の Pages（= Workers）」へ
**委譲**され、`wrangler.jsonc` の `assets` が無いと
`Missing entry-point to Worker script or to assets directory` で失敗する。
wrangler 自身が「そのまま再実行しても同じように失敗する」と警告してくる。

**ルール**: 従来の Pages にプロジェクトを作るなら初回だけ `--force` を付ける。
プロジェクトが出来た後の `wrangler pages deploy` には `--force` は不要（付けない）。
今後の新規案件は Workers 静的アセット（`assets.directory`）側に寄せるほうが素直。

### `images.unoptimized` にするときは `public/` の画像サイズを必ず確認する

`output: 'export'` では `next/image` の最適化サーバーが無くなるので
`images.unoptimized: true` が要る。これは「元ファイルがそのまま配信される」ということ。
このリポジトリでは `logo.png` が 1024px / **2.0MB** あり、44px 表示と PWA アイコンに
共用されていた。最適化に守られて問題が見えていなかった。

**ルール**: 画像最適化を外す変更をしたら、その場で `find public -size +100k` を走らせ、
表示サイズに合った画像を用意し直す。

### 静的書き出しの `NEXT_PUBLIC_*` は `.env.local` に食われる

`NEXT_PUBLIC_*` はビルド時にバンドルへ焼き込まれる。開発用の `.env.local` は
`.env.production` より**優先度が高い**ため、`.env.production` に本番 URL を書いても
`.env.local` の localhost が本番バンドルに入り込む。

**ルール**: 本番ビルドの値は package.json のスクリプト内で環境変数として渡す
（コマンドラインの env は `.env.local` より優先される）。
デプロイ後は `grep -rl "localhost" out/` が空であることを確認する。
