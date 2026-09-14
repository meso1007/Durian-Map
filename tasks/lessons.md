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
