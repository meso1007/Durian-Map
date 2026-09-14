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

---

## 2026-09-14: モバイル UI を .pen デザインに寄せる

### 計画
- [x] 390x844 で実際に触って使いづらさの原因を特定する
- [x] 検索コントロールをボトムシートからヘッダーへ移す
- [x] ボトムシートをリスト専用にし、検索後に畳まないようにする
- [x] 下部タブバー（さがす / 保存）を作る
- [x] ロゴを `.pen` からベクタで起こす
- [x] 営業時間・電話番号を追加する（backend）
- [x] 営業状態をカード枠線と地図ピンの枠で表す
- [x] 距離表示と「近い順」並び替え
- [x] 本番で確認してデプロイ

### レビュー

**根本原因**: ボトムシート（45vh ≒ 380px）の中に検索フォーム一式が入っており、
19 件ヒットしても**結果カードが 1 枚も見えていなかった**。`.pen` は検索コントロールを
ヘッダー側に置いており、案どおりに作っていれば起きなかった乖離。

**結果**: 検索直後に**カードが 2 枚+α 見える**（DOM 計測で `fullyVisibleCards: 2`）。
ヘッダーは検索後に畳まれ、CTA は入力欄の左のアイコンボタンになる。

**ロゴ**: `.pen` の `Durian Logo`（160x160 / 19 パス）を SVG に変換する
`designs/pen-logo-to-svg.py` を作り、`logo.svg` → PWA アイコン / apple-icon を生成。
`.pen` を直したら流し直せる。favicon は `app/icon.svg` に置き換え（`favicon.ico` は削除）。

**追加データ**: `weekdayDescriptions` と `nationalPhoneNumber` を FIELD_MASK に追加。
`regularOpeningHours` / `rating` / `websiteUri` で既に Enterprise ティアを払っており、
**課金ティアは上がらない**ことを Places のデータフィールド表で確認済み。

**途中で見つけた問題**:
1. 別ワークツリー（`../iOS`）が同じ Worker `durian-map-api` にデプロイしており、
   こちらの backend 変更が上書きされていた（14:13 の自分のデプロイ → 14:20 に別デプロイ）
2. `fitBounds` の padding 72px が、シートを開いた状態の地図の高さを超えて
   日本全体まで引いた絵になっていた → 短辺の 18% で上限をかけた
3. Lead にフィールドを足したのにキャッシュキーの版を上げていなかった → `SCHEMA_VERSION` を追加

**未対応（意図的）**: 行きたい / 訪問済み（スコープ外指定）、クチコミ（課金ティアが上がる）、
タグ（実データ無し・design.md で禁止）、履歴 / マイページ（機能が無い）。

---

## 2026-09-15: 刷新されたデザイン案を実装に反映

`origin/main` をマージして更新後の `.pen` を取り込み、実装を合わせた。

### 計画
- [x] `origin/main` をマージして更新後の `.pen` を取り込む
- [x] 新ブランドマーク（4 パス）から SVG / PWA アイコン / favicon を作り直す
- [x] ヘッダーをブランドロックアップ + `#17492E` に、文言を「近くからさがす」等へ
- [x] エリアチップを廃止し、絞り込みチップ（営業中 / 価格帯 3 段）を実装
- [x] backend に `priceLevel` を追加（SCHEMA_VERSION v3）
- [x] カードを新デザインへ（営業中バッジ廃止 → 開店時刻、訪問済みバッジ）
- [x] 「行きたい / 訪問済み」と保存画面のセグメンテッドコントロール
- [x] 本番で確認してデプロイ

### レビュー

**ブランドが全面刷新されていた**。旧 `Durian Logo`（サングラスのドリアン・20 パス）は
削除され、**断面が "D" を形づくるマーク**（Stem / Spiky Half / Rind / Flesh の 4 パス）に。
Dark / Light 変種、App Icon、Wordmark の 6 フレーム構成。
変換スクリプトを `designs/pen-frame-to-svg.py` に作り直した（変数参照の解決・背景・入れ子対応）。

**検証結果**（390x844 / 現在地エミュレーション / DOM 計測）:
- 全 19 件 → 営業中のみ **5 件** / 〜¥1,000 **2 件** / 〜¥1,000 + ¥1,000〜2,000 **19 件**（OR）
- ¥2,000〜 は **0 件 → 「条件に合うカフェがありません」** の空状態
- 検索直後に見えるカード **2 枚**（前回の到達点を維持）
- 旧形式の保存データ（`status` なし）が「行きたい」として移行されることを実測で確認
- コンソールエラー 0

**デザイン案と意図的に変えた点**:
1. **タグ（自家焙煎 / 個人経営 / Wi-Fi）は実装しない** — Places から取れず推測になる
   （`design.md` §0-2 に理由を明記）
2. **カードの営業状態の枠線は残す** — 新デザインで営業中バッジが消えたぶん、
   枠が唯一の手がかりになる
3. **訪問済みバッジは住所と同じ行**に置いた — 住所を消すと店を特定しにくい
4. **絞り込みチップは横スクロール 1 行** — 折り返すと 2 行になりカードが 1 枚しか見えない
5. **下部タブバーは 2 タブのまま** — `.pen` の履歴 / マイページは機能が無い

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
- [x] 1. `next.config.ts` を `output: 'export'` + `images.unoptimized` に
- [x] 2. `layout.tsx` に `viewportFit: 'cover'`、ヘッダー等に `env(safe-area-inset-*)` を適用
- [x] 3. プラットフォーム差分を `lib/` に閉じ込める（UI から直接ネイティブ API を呼ばない）
      - `lib/platform.ts`（ネイティブ判定）
      - `lib/storage.ts` を Capacitor Preferences に差し替え
      - `lib/geolocation.ts` / `lib/share.ts` を新設し `page.tsx` の呼び出しを置換
- [x] 4. 2.0MB のロゴを表示サイズに合わせて縮小（WebView の初回描画対策）
- [x] 5. Capacitor 導入（`capacitor.config.ts` / `cap add ios --packagemanager SPM`）
- [x] 6. `Info.plist` に位置情報の用途文言・表示名を設定
- [x] 7. アイコン / スプラッシュ生成（`@capacitor/assets`）
- [x] 8. `ALLOWED_ORIGINS` に `capacitor://localhost` を追加して Worker を再デプロイ
- [x] 9. シミュレータで起動し確認（下記「検証結果」）
- [x] 10. ドキュメント更新（README / platform-strategy / ToDo）とコミット

### 検証結果（iPhone 17 シミュレータ / iOS 26.2）

自動で確認できたもの:

| 項目 | 結果 |
|---|---|
| ビルド（SPM・CocoaPods なし） | `** BUILD SUCCEEDED **` |
| 起動・WebView 描画 | OK（スプラッシュ → 画面表示） |
| セーフエリア | OK。ヘッダーが Dynamic Island に潜らない |
| 地図（Maps JS を `capacitor://` から読み込み） | OK |
| 現在地（Capacitor Geolocation） | OK。`simctl location` の座標を取得 |
| 逆ジオコード（Nominatim 直叩き） | OK。「渋谷区」が入力欄に入る |
| 検索 API（`capacitor://localhost` の CORS） | OK。curl で `access-control-allow-origin: capacitor://localhost` を確認 |
| 検索 → 一覧・マーカー・写真の描画 | OK。渋谷で 19 件、クラスタリングと写真プロキシまで動作 |
| JS エラー / CORS エラー | ログに無し（残るのは Maps JS 内部の WebP デコード警告のみ） |

未確認（タップ操作が要るもの。`osascript` のクリックは補助アクセス権限が無く `-25211` で失敗する）:

- 保存タブへの保存とアプリ再起動後の復元（Capacitor Preferences）
- 共有シート（`@capacitor/share`）
- ボトムシートのスワイプ操作

> 検索の描画は、ビルド済み `out/` をローカル配信して `server.url` に
> `?area=渋谷` を渡す形で WebView 内から確認した（検証後に設定は戻してある）。

## レビュー

**やったこと**: `docs/platform-strategy.md` の B 案（Capacitor）をそのまま実装した。
Web と iOS は同一コードベースのままで、差分は `frontend/src/lib/` の 4 ファイルに閉じ込めた。

**設計判断**:
- **CocoaPods を使わず SPM**。このマシンの system Ruby が 2.6 で CocoaPods を入れづらく、
  Capacitor 8 は SPM に対応しているため回避できた。依存が Xcode 管理になり後片付けも楽。
- **`navigator.*` を UI から追い出した**。`storage.ts` だけが抽象化されていたが、
  位置情報・共有も同じ理由で差し替えが必要だったので同じ形に揃えた。
- **`alert()` をトーストに置換**。ネイティブで `alert()` はアプリ内ダイアログとして浮くうえ、
  この画面には既にトーストがある。`--dm-success` はトークン表で「保存完了トースト」用と
  定義済みだったので、それに合わせた。

**ついでに直した既存の問題**:
1. ヘッダーのロゴが 1024px / 2.0MB の画像を 44px で描画していた → 192px / 61KB に
2. `docs/design.md` のフォント TODO が全部実装済みなのに未チェックのままだった
3. ESLint が `ios/` 配下のビルド成果物を舐めて 24 errors を出していた → ignore 追加

**次にやること**: `ToDo.md` の「次のマイルストーン: iOS の配布」。
特に **iOS 用の地図キー**（`capacitor://` にリファラー制限が効かない）は配布前に必須。

### やらないこと（今回の範囲外）
- React Native への移植（`docs/platform-strategy.md` の移行条件を満たしていない）
- Swift でのチェーン店判定の再実装（**禁止**。ロジックの正はサーバー側）
- ダークモード対応、App Store 提出作業

---

## 2026-09-14: デザイン刷新（cloudflare-migration）の取り込みと iOS への反映

`GaloisExtension/cloudflare-migration` の 2 コミット（静的書き出し + Pages デプロイ /
`.pen` 準拠の UI 刷新）を iOS ブランチにマージし、iOS 側を新デザインに合わせた。

### やったこと
- [x] マージ（衝突 12 件）。UI・設定は向こうを土台にし、iOS 対応を再適用
- [x] `page.tsx` の再適用: `lib/geolocation.ts` / `lib/share.ts` 経由、トースト、
      ヘッダーのセーフエリア加算（下部タブバーは向こうが対応済みだった）
- [x] `build:ios` を `build:prod` に乗せ、API URL の指定を二重に持たないようにした
- [x] 共有 URL の土台に Pages の本番 URL を焼き込み（`NEXT_PUBLIC_WEB_BASE_URL`）
- [x] アイコン / スプラッシュを新しい `public/logo.svg` から再生成し、生成手順を
      `scripts/gen-ios-assets.mjs` に切り出した
- [x] Worker を再デプロイ（`ALLOWED_ORIGINS` に Pages と capacitor の両方）
- [x] コードレビュー指摘の反映（世代 ID / 未使用プラグインの削除）

### 検証結果（iPhone 17 シミュレータ / iOS 26.2）

| 項目 | 結果 |
|---|---|
| ビルド（SPM） | `** BUILD SUCCEEDED **` |
| 新 UI の反映 | OK。ヘッダー検索 → 検索後に畳む → 下部タブバー |
| 新ロゴ（`.pen` 由来の SVG） | OK。アプリアイコン・スプラッシュも再生成 |
| 位置情報の許可ダイアログ | OK。`Info.plist` の日本語文言が表示される |
| セーフエリア | OK。ヘッダー（上）・タブバー（下）とも潜らない |
| 検索 → 結果カード | OK。渋谷 19 件、**カードが 2.5 枚見える**（刷新の狙いどおり） |
| 営業状態の枠線・ピン枠 | OK。準備中がハイビスカス枠で出ている |
| CORS（4 オリジン） | OK。Pages / capacitor / localhost は許可、他は拒否 |

未確認（タップが要る）: 保存の永続化（再起動後）・共有シート・シートのスワイプ。

### レビュー

**危なかった点**: `ALLOWED_ORIGINS` を両ブランチが別々に編集して別々にデプロイしていたため、
**後からデプロイしたほうが相手のオリジンを消していた**。マージ前の実測では
`capacitor://localhost` が拒否される状態（= iOS アプリの検索が全滅）だった。
→ 教訓を `tasks/lessons.md` に記録。

**設計として良かった点**: プラットフォーム差分を `lib/` に閉じ込めていたおかげで、
UI が 549 行書き換わっても iOS 対応の再適用は `page.tsx` の 10 箇所で済んだ。
`lib/` の 4 ファイルは**一切変更不要**だった。

---

## 2026-09-15: ブランド刷新（新しい .pen）の取り込みと iOS への反映

`GaloisExtension/cloudflare-migration` の `e83d439`（更新後の `.pen` に合わせた
ブランド刷新 + 検索体験の更新）をマージし、iOS 側を合わせた。`main` の `AGENTS.md`
追加もこのマージで入っている。

### やったこと
- [x] マージ（衝突 4 件: `page.tsx` / `storage.ts` / `tasks/*.md`）
- [x] `storage.ts`: 向こうの新スキーマ（`status` / `savedAt` と旧形式の移行）を
      **こちらの Preferences バックエンドの上に載せ直した**。移行ロジックは Web / iOS 共通
- [x] `page.tsx`: 新 UI を土台に iOS 対応を再適用（12 箇所）
- [x] **アイコン / スプラッシュの生成を作り直した**（下記）
- [x] ドキュメント更新（`frontend/README.md` / `docs/design-tokens.md`）

### アイコン生成で見つけた問題

新ブランドは Dark（淡色マーク・濃緑面用）と Light（濃緑マーク・淡色面用）の 2 変種。
旧スクリプトは `public/logo.svg`（= Dark 変種）をそのまま使っていたため、
**そのまま流すとクリーム地のスプラッシュにほぼ見えないマークが載る**ところだった。

- スプラッシュ → Light 変種（`public/logo-light.svg`）に変更
- アプリアイコン → `.pen` の App Icon フレーム（`src/app/icon.svg`）を使用。
  **`rx` を落として角丸を消し、アルファを潰した**（iOS は自前で角丸を付ける。
  透明が残ると App Store の審査で弾かれる）
- 生成結果を実測: 1024×1024 / RGB（アルファなし）/ 四隅 `#FFF9EC`

### 検証結果（iPhone 17 シミュレータ / iOS 26.2）

| 項目 | 結果 |
|---|---|
| ビルド | `** BUILD SUCCEEDED **` |
| 新ブランド | OK。マーク + 「urian Map」のロックアップ、ヘッダー面が `--durian-green-800` |
| 新 CTA / 検索欄 | OK。「近くからさがす」 |
| 絞り込みチップ | OK。営業中 / 価格帯 3 種が横スクロールの 1 行で表示 |
| カード | OK。開店時刻（`8:00-`）と営業状態の枠線 |
| セーフエリア | OK。ヘッダー（上）・タブバー（下）とも潜らない |
| 検索 | OK。渋谷で結果・地図ピン・写真まで描画 |

未確認（タップが要る）: 保存の永続化と**旧形式データの移行**、状態切り替え
（行きたい / 訪問済み）、共有シート。

### レビュー

**効いた構造**: `lib/` に差分を閉じ込める方針が今回も効いた。UI が 495 行、
ブランドが全面刷新されても、iOS 対応の再適用は `page.tsx` の 12 箇所 +
`storage.ts` の読み書き 2 関数だけで済んだ。

**気をつける点**: ブランド素材が複数変種を持つようになったので、
「どの面にどの変種か」を `docs/design-tokens.md` に書き、生成スクリプトも
それに従わせた。次にロゴが変わっても `bun run ios:assets` 一発で追従する。

---

## 2026-09-15: 総合レビュー → P0 実装 → デプロイ → デザインモック

レポート: `docs/review-2026-09-15.md`（§5 が実装スコープの正）。

### 計画
- [x] 現状把握（main / GaloisExtension/iOS / 本番 Worker・Pages / 料金一次情報）
- [x] サブエージェントでバックエンド security review・フロント react review・料金調査
- [x] `GaloisExtension/iOS` を `feat/review-2026-09-15` に統合（CLAUDE.md は main 構造 + iOS 記述）
- [x] レポート執筆 `docs/review-2026-09-15.md` + コスト試算 `tasks/cost_model.py`
- [x] P0 バックエンド実装（Opus サブエージェント / 別ワークツリー）→ `67066d5` にマージ。typecheck / 92 tests 通過
- [x] P0 フロントエンド実装（Opus サブエージェント / 別ワークツリー）→ `283828e` にマージ。lint / build:prod 通過、preload 4
- [x] 両ワークツリーをマージし `typecheck` / `test`（92 件）/ `lint` / `build:prod` を通す
- [x] Worker デプロイ（Version `b419d7bf`。`/health` で 2 つの secret が true）
- [x] Pages デプロイ → 本番で検索 19 件 / 署名付き写真 19 枚 / URL 同期 / 再検索ピル / CORS（Pages・capacitor）を確認
- [x] `.pen` デザインモック（iOS 版 6 画面 / Web 版 3 画面）を生成し PNG を確認
- [x] ToDo.md / tasks/lessons.md / README を更新して PR

### レビュー

**やったこと**: 現状把握 → 3 つのサブエージェント（料金調査 / backend security / frontend react）で
独立レビュー → 指摘を本番とビルド成果物で再検証 → レポート → iOS ブランチ統合 → Opus 2 体で
P0 を並行実装（別ワークツリー）→ 自分でマージ・検証 → Worker → Pages の順でデプロイ →
puppeteer で本番を 390x844 / 1440x900 の両方から実操作して確認。

**本番で確認できたこと**（2026-09-15 01:40 JST）:
- `/health`: `googleApiKeyConfigured` / `photoSigningConfigured` ともに true
- 渋谷で 19 件。全カードに署名付き写真と「〜まで / 〜から」。画面内に見えるカードはモバイル 3 / PC 7
- 署名無し・不正署名の写真は 400。`category=ラーメン` は 400。空の `lat=&lng=` は area 検索に倒れる
- 同一 3 桁セル + 半径 snap で 2 回目以降 `cached: true`
- URL が `?area=渋谷&cafe=<id>` / `?tab=saved` に書き戻され、リロードで 19 件復元
- 地図ドラッグで「このエリアで再検索」ピルが出る。CORS は Pages と `capacitor://localhost` を許可
- コンソールエラーは Google Maps 内部の `transparent.png` の 1 件のみ（コード起因ではない）

**判断したこと**:
- 未マージの iOS ブランチが本番の実体だったので、レビューの前提として先に統合した
- 写真キャッシュは R2 でなく KV にした（wrangler トークンに R2 権限が無い。P2 で移行）
- 写真の署名鍵は専用 secret にした（`GOOGLE_API_KEY` の流用より運用が明確）
- Worker を先にデプロイして数十秒だけ旧フロントの写真が出ない時間を許容した（Pages が続けて完了）

**残したもの（ユーザー作業 / P1）**: Google Cloud のキー制限と予算アラート、iOS 用の地図キー、
Co Headline のライセンス確認、実機での iOS 確認、旧 Cloudflare アカウントの後片付け。
詳細は `docs/review-2026-09-15.md` §5 と `ToDo.md`。
