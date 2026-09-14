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

## 2026-09-14: モバイル UI / 複数ワークツリー

### 「使いづらい」は必ずその幅で実際に触って測る

ボトムシートの中に検索フォーム（CTA 56 + 入力 48 + チップ 44 + タブ 44）が入っていて、
390x844 では **19 件ヒットしても結果カードが 1 枚も見えていなかった**。
PC 幅では気づけない。デザイン案（`.pen`）は検索コントロールをヘッダー側に置いており、
案どおりに作っていればこの問題は起きなかった。

**ルール**: モバイルの UI を直すときは Chrome DevTools MCP の
`emulate` で `390x844,mobile,touch` + 現在地を入れて**実際に操作してから**直す。
合格条件は「見えるか」ではなく「**何枚見えるか**」のように数えられる形にする。

### 同じ Cloudflare Worker を複数のワークツリーからデプロイすると上書きし合う

`backend/wrangler.jsonc` の `name` が同じなので、別ブランチのワークツリー
（`../iOS` など）が `wrangler deploy` すると**こちらのデプロイが消える**。
実際に 14:13 の自分のデプロイが 14:20 の別デプロイで上書きされ、
追加したフィールドが API から消えた。

**ルール**: API の挙動がデプロイ直後と変わったら、まず
`wrangler deployments list` で**自分の Version ID が最新か**を確認する。
ブランチごとに検証したいなら Worker 名か環境を分ける。

### `fitBounds` の余白は地図の高さを超えうる

ボトムシートを開くと地図が 100px 程度まで縮む。そこに padding 72px を渡すと
収まる領域が残らず、Google Maps は**極端に引いた絵**になる（日本全体が見えた）。

**ルール**: `fitBounds` の padding は固定値で渡さず、
地図要素の短辺に対する割合で上限をかける（実装は `MapView.tsx` の `MapController`）。

### Lead にフィールドを足したらキャッシュキーの版も上げる

KV の TTL は 24 時間。キーを変えないと、旧スキーマのキャッシュが
**新フィールド抜きのまま返り続ける**。`backend/src/cache.ts` の `SCHEMA_VERSION` を上げる。

---

## 2026-09-14: iOS（Capacitor）導入

### Capacitor は CocoaPods なしで入る（SPM）

Capacitor 7 以降は `npx cap add ios --packagemanager SPM` で Swift Package Manager を
使える。公式プラグインはほぼ SPM 対応済み。このマシンは system Ruby が 2.6 で
CocoaPods のインストールが面倒だったが、**そもそも入れる必要がなかった**。

**ルール**: iOS のセットアップで CocoaPods に詰まったら、先に SPM で回避できないか見る。

### WebView の Origin は `capacitor://localhost`

サーバー側の CORS ホワイトリストに入れていないと、iOS からの API 呼び出しが全部
落ちる。ブラウザでは起きず、アプリを動かして初めて分かる種類の不具合。
`https://` 前提の制限（Google Maps の HTTP リファラー制限など）も同様に効かない。

**ルール**: WebView で包むときは「オリジンが変わることで壊れるもの」を先に洗う
（CORS / リファラー制限 / `window.location.origin` を使った URL 生成 / Cookie）。

### `package.json` の `ignoreScripts` は後から効いてくる

このリポジトリは `sharp` を `ignoreScripts` に入れているため、`@capacitor/assets`
（アイコン生成）が「sharp のネイティブバイナリが無い」で落ちた。
`node_modules/sharp` で `node install/libvips.js && node install/dll-copy.js` を
一度走らせれば直る。→ `frontend/README.md` に記載。

### シミュレータの自動操作には「アクセシビリティ」権限が要る

`xcrun simctl` にはタップを送るコマンドが無く、`osascript` の click は
補助アクセス（アクセシビリティ）権限が無いと `-25211` で失敗する。
スクリーンショット（`xcrun simctl io <dev> screenshot`）とインストール/起動は権限なしで可能。

**ルール**: シミュレータでの操作確認は、権限が無い前提で「起動時の描画」までを自動で確認し、
タップが要る確認はユーザーに依頼するか、事前に権限を取っておく。

## 2026-09-14: 共有リソースをブランチごとに編集したときの上書き

### Worker の環境変数は「最後にデプロイしたブランチ」が勝つ

`ALLOWED_ORIGINS` を iOS ブランチ（`capacitor://localhost` を追加）と
Pages ブランチ（本番 URL を追加）が別々に編集し、別々に `wrangler deploy` した結果、
**後からデプロイしたほうが相手の追加分を消していた**。
Git 上は両方のコミットが残るので、マージするまで誰も気づかない。

**ルール**: 複数ブランチが同じデプロイ先の設定（環境変数・許可リスト）を触るときは、
デプロイ後に**設定ファイルではなく実際のエンドポイントへ問い合わせて**確認する。

```bash
curl -s -i -H "Origin: capacitor://localhost" "$API/api/search?..." | grep -i access-control-allow-origin
```

### `wrangler deploy` 直後の検証は数秒待つ

デプロイ完了メッセージの直後に叩くと、まだ旧バージョンが応答することがある。
「追加したオリジンだけ拒否される」という紛らわしい結果になった（数秒後には正常）。

**ルール**: デプロイ直後に検証して想定と違ったら、まず数秒おいて再実行する。
