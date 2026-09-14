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

## 2026-09-15: デザイン更新の取り込み

### `.pen` の色は変数参照。解決しないと全部黒で出る

更新後の `.pen` は `fill` が `"$lime"` のような**変数参照**になっていた。
旧ロゴは素の HEX だったので、変換スクリプトがそのまま SVG に書いても通っていた。
未解決のまま書くと SVG では不正な色となり、ブラウザは**黒**で描く。
生成物を見るまで気づけなかった。

**ルール**: `.pen` からアセットを起こしたら**必ずラスタ化して目視する**。
色は `document.variables[name].value` で解決してから書き出す。

### ロゴを作り直したらフレーム名ごと変わりうる

旧 `Durian Logo`（20 パス）は削除され、`Durian Mark 160 Dark` /
`App Icon Light` など**6 フレームに再編**されていた。
フレーム名を決め打ちした変換スクリプトは動かなくなる。

**ルール**: `.pen` を更新したら、まずトップレベルのフレーム一覧を出して
構造の変化を確認してから差分を取る。

### Cloudflare Pages は本番 URL のキャッシュが残る

デプロイ直後に本番 URL を開くと**旧ビルドが返る**。
`reload({ignoreCache:true})` でも取れず、`?cb=<timestamp>` を付けて初めて新しくなった。
HTML 自体は `curl` で見ると新しかったので、ブラウザ側のキャッシュ。

**ルール**: デプロイ後の確認は URL にクエリを足す。`curl` で HTML の中身を見て
「サーバーは新しい / ブラウザが古い」を切り分けてから、見えているものを判断する。

### JSX の式の中にコメントは置けない

`{cond && ( {/* comment */} <div>…)}` は構文エラーになる。
コメントは条件式の外に出す。

---

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

### `wrangler deploy` 直後の検証は「変わるまで」繰り返す

デプロイ完了メッセージの直後に叩くと、まだ旧バージョンが応答することがある。
「追加したオリジンだけ拒否される」という紛らわしい結果になった。
**8 秒待っても足りないことがあった**（十数秒で正常化）。

**ルール**: 固定の sleep ではなく、期待する応答になるまで数回リトライして確認する。

```bash
for i in $(seq 1 10); do
  curl -s -i -H "Origin: capacitor://localhost" "$API/api/search?area=渋谷&category=カフェ" \
    | grep -qi "^access-control-allow-origin" && { echo OK; break; }
  sleep 5
done
```

### 恒久対処: 環境で変わらない値は環境変数に置かない

`capacitor://localhost` は「iOS アプリそのものの Origin」であって環境ごとの設定ではない。
`ALLOWED_ORIGINS` に置いていたせいで、別ブランチがその行を編集してデプロイするたびに
消えていた（**同じ事故を 2 回起こした**）。`backend/src/index.ts` の
`NATIVE_APP_ORIGINS` に移し、コードとして常に許可するようにした。

**ルール**: 「環境で変わるか？」で置き場所を決める。変わらないならコードに置く。
そうすればマージで自然に合流し、設定の編集合戦で消えない。

## 2026-09-15: ブランド刷新に追従するとき

### ロゴが「変種」を持ち始めたら、生成スクリプトの入力を疑う

ブランドが Dark（淡色マーク）/ Light（濃緑マーク）の 2 変種になったとき、
既存の生成スクリプトは `public/logo.svg`（= Dark 変種）を指したままだった。
そのまま流すと**クリーム地のスプラッシュに淡色のマークが載って見えなくなる**。
ファイル名が変わらないので、差分を見ても気づけない。

**ルール**: ブランド素材が更新されたら、生成物を**目視または画素で確認する**。
「どの面にどの変種を使うか」はトークン表（`docs/design-tokens.md`）に書いて、
スクリプトはそれを参照する形にしておく。

### iOS のアプリアイコンは「角丸なし・アルファなし」

デザイン案の App Icon フレームは角丸（`rx`）付きで描かれているが、iOS は自前で
マスクをかけるため、そのまま使うと二重に角が落ちる。透明部分が残っていると
App Store Connect のアップロードで弾かれる。

**ルール**: アイコンを書き出すときは `rx` を 0 にし、地の色で `flatten` する。
確認は `Image.open(p).mode`（`RGB` であること）と四隅の画素で機械的にできる。

## 2026-09-15: 総合レビュー → P0 実装 → デプロイ

### main だけ見て現状を判断しない

`main` の README は「フロント未デプロイ」だったが、実際は別ワークツリー（`~/orca/workspaces/…`、
`GaloisExtension/iOS`）の成果物が Worker も Pages も本番で動いていた。両ブランチが同じ Worker を
別々にデプロイして上書きし合う事故も起きていた。

**ルール**: 着手時に `git worktree list` / `git branch -a` を見て、main より進んだブランチを先に洗う。
本番の実体は `curl` でスキーマを叩いて確認する（`weekdayDescriptions` があるか等）。

### 「入力長の上限が無い」系は実データの長さを測る

写真リソース名は実測 457〜494 文字。`photo:v1:<name>:800x800` は 511 バイトで KV の上限 512 に
残り 1 バイトだった。名前が少し伸びた瞬間に写真キャッシュが静かに死に、費用対策が丸ごと無効になる。
→ キーは SHA-256 でハッシュ化（固定長）。

**ルール**: 外部 API 由来の値をキーに使うときは、実データの長さを測ってから上限を設計する。
レビューで LOW に見えても、費用対策の中核に効く箇所は実測する。

### ドメインのブロックリストは「200 が返るか」で実在確認しない

`veloce.jp` は高級バッグ通販、`kohikan.jp` はスパム、`musashinomori.jp` は病院だった。
title まで見て初めて分かる。逆に `doutor.co.jp` は実在するのに sandbox からは応答が無く、
否定側の判定には使えない。

**ルール**: 店名のトークンで拾い、ドメインは**店舗ブランドの公式サイト**だけ、
持株会社ドメイン（`ucc.co.jp` 等）は入れない。追加時は `chains.test.ts` に固定例を足す。

### `next/font/google` の CJK は既定の `preload: true` が地雷

4 ウェイトで `<link rel="preload">` が 362 本 / 5.3MB 出ていた。`preload: false` +
`display: 'swap'` + `fallback` を必ず付ける。

**ルール**: ビルド後に `grep -o 'rel="preload"' out/index.html | wc -l` が 1 桁であることを
検証条件にする（今回 362 → 4）。

### eslint-config-next 16 は effect 内 setState / 描画中の ref 書き込みを error にする

`useCallback` の中身まで追うので、その中に `setState` があるだけで落ちる。

**ルール**: 「props から派生する state」は effect ではなく描画中に調整し、
マウント時の値は `useState(() => 初期値)` で最初から入れる。

### chrome-devtools MCP は 1 プロファイル 1 プロセス

並行エージェントが掴んでいると `isolatedContext` でも回避できず、相手の Chrome を落とすのは厳禁。

**ルール**: 並行して UI 検証するときは `puppeteer-core` + 自前 `userDataDir` で独立 Chrome を立てる。
静的書き出しの検証は `ALLOWED_ORIGINS` に入っているポートで配信する（ポート違いは CORS で
全滅してコードの不具合に見える）。dev でだけ出る `?_rsc=` の 404 を本番の不具合と混同しない。

### サブエージェントのワークツリーは main 起点で作られる

`isolation: worktree` のワークツリーは作業ブランチではなく `main` から切られる。
指示に「このブランチにしか無いファイル」があると、エージェントが自分で fast-forward することになる。

**ルール**: ワークツリーで並行実装させるときは、プロンプトに「まず `git merge --ff-only <作業ブランチ>`
してから着手」と明記する。マージ後は自分で typecheck / test / lint / build を再実行する。

### pen CLI の `--in` は元ファイルのフレームをそのまま引き継ぐ

`--in` でブランド変数を継承させると、旧画面フレームも出力に残る。ブランド一貫性のためには有効だが、
成果物の説明に「既存フレームを含む」と書いておく。Co Headline のような商用フォントは
pen.dev のレンダラに無く、変数で代替（Outfit）される。

### 秘密情報は TTY 無しでも `< file` で入る

`wrangler secret put NAME < file` なら対話プロンプト無しで正しい値が入る（空保存の事故は
プロンプトが EOF を読んだときだけ）。設定後は `/health` の `*Configured: true` で値が空でないことを確認する。
