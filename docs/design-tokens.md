# Durian Map カラートークン

`designs/durian-map-tropical.pen` のデザイン案から確定したカラーコード。
実装は `frontend/src/app/globals.css` の CSS 変数（`--durian-*`）を正とし、Tailwind の任意値 `#xxxxxx` 直書きは順次この変数に置き換える。

## ブランドカラー（ドリアン）

| トークン | HEX | 用途 |
|---|---|---|
| `--durian-green-900` | `#14532D` | ヘッダー下端・最も濃い緑、見出しテキスト |
| `--durian-green-700` | `#1F6B3F` | ヘッダー背景、主ボタン（地図でみる）、アクティブタブ |
| `--durian-green-500` | `#2E8B57` | ボタン hover、営業中ドット、リンク |
| `--durian-lime-400` | `#A8CF3B` | ロゴ・果皮のライム、選択リング、クラスタ |
| `--durian-lime-100` | `#E4F3BA` | 営業中バッジ背景、タグ背景（緑系） |
| `--durian-cream-50` | `#FFF7E6` | 画面背景、ボトムシート、カード地 |
| `--durian-cream-100` | `#FDF1D4` | 入力欄・チップ背景、区切り |
| `--durian-cream-200` | `#F3E4B8` | 罫線、スケルトン、影付きカードの縁 |
| `--durian-seed-900` | `#1F3218` | 本文テキスト（最濃） |
| `--durian-seed-600` | `#5C6B4A` | サブテキスト、住所、口コミ数 |

## トロピカルアクセント

| トークン | HEX | 用途 |
|---|---|---|
| `--tropic-mango-500` | `#F6A21B` | 「現在地の周辺で探す」CTA（**ベタ塗り**。グラデーションは使わない → `design.md`） |
| `--tropic-mango-700` | `#D97706` | CTA 押下、注意ラベル |
| `--tropic-hibiscus-700` | `#B3164F` | **淡色地に載せる文字用**（準備中バッジの文字、保存中ボタンの文字） |
| `--tropic-hibiscus-500` | `#E2467C` | 面・枠・アイコン・マップピン A（**文字には使わない**） |
| `--tropic-hibiscus-100` | `#FCE1EA` | 行きたいバッジ背景、Wi-Fi など桃系タグ |
| `--tropic-lagoon-500` | `#2BB3B1` | マップピン B、シアン系タグ、現在地マーカー |
| `--tropic-lagoon-100` | `#D6F2F1` | シアン系タグ背景、地図の水域 |
| `--tropic-sun-500` | `#F2B705` | 評価の星 |

## セマンティック

`:root` では `--dm-*`、Tailwind の `@theme inline` では `--color-*`（`bg-primary` などのユーティリティ）として公開する。

| トークン | 参照 | 用途 |
|---|---|---|
| `--dm-primary` | `--durian-green-700` | 主要アクション |
| `--dm-cta` | `--tropic-mango-500` | 最重要 CTA（1 画面 1 つ） |
| `--dm-accent` | `--tropic-hibiscus-500` | お気に入り・強調 |
| `--dm-info` | `--tropic-lagoon-500` | 位置情報・補助情報 |
| `--dm-success` | `--durian-green-500` | 営業中、保存完了トースト |
| `--dm-error` | `#C2410C` | エラートースト（クリーム地でコントラスト 5.6:1） |
| `--dm-surface` | `--durian-cream-50` | 面 |
| `--dm-border` | `--durian-cream-200` | 罫線 |
| `--dm-text` | `--durian-seed-900` | 本文 |
| `--dm-text-muted` | `--durian-seed-600` | サブテキスト |
| `--dm-success-text` | `--durian-green-700` | 淡緑地（lime-100）に載せる文字。営業中バッジ |
| `--dm-accent-text` | `--tropic-hibiscus-700` | 淡桃地（hibiscus-100）に載せる文字。準備中・保存中 |

## 地図スタイル

| 要素 | HEX |
|---|---|
| 陸地 | `#EEF5D9` |
| 道路 | `#FFFFFF` / 幹線 `#F7E9B5` |
| 水域 | `#CFEDEB` |
| 公園・緑地 | `#D5EBB0` |
| ラベル文字 | `#5C6B4A`（駅名・地名は表示する） |

## 営業状態の表現

バッジだけでなく、**カードの枠線と地図ピンの枠**でも営業状態を表す。
枠線・ピン枠は非テキスト要素なので必要なコントラストは **3:1**（`-500` 系をそのまま使ってよい）。
**文字には使わないこと** — 文字は下の「使用ルール」に従う。

| 状態 | バッジ | カード枠線 | 地図ピンの枠 |
|---|---|---|---|
| 営業中 (`openNow === true`) | lime-100 地 / `--dm-success-text` | `--dm-success` `#2E8B57` | `--durian-green-900` `#14532D` |
| 準備中 (`openNow === false`) | hibiscus-100 地 / `--dm-accent-text` | `--tropic-hibiscus-500` `#E2467C` | 同左 |
| 不明 (`undefined`) | 出さない | `--dm-border` | `#FFFFFF` |

> ピンだけ濃い緑にしているのは、ピン本体が黄緑（`#8FC63C`）で `-500` の緑だと枠が埋もれるため。
> 実装は `frontend/src/app/page.tsx` の `openStatusBorder()` と
> `frontend/src/app/components/MapView.tsx` の `statusRingColor()`。

## 使用ルール

- 緑（primary）とマンゴー（CTA）は同じ画面で役割を分ける。CTA は「現在地の周辺で探す」など 1 画面につき 1 つ。
- ハイビスカスは「保存・行きたい・準備中」など感情や状態の強調に限定し、面積を小さく使う。
- テキストはクリーム地に `--durian-seed-900` / `--durian-seed-600` を使い、黄色地に黄色文字の組み合わせは禁止（コントラスト比 4.5:1 未満）。
- **淡色地（`-100` 系）に文字を載せるときは `-500` をそのまま使わない。** 4.5:1 を満たさない。
  文字には `--dm-success-text` / `--dm-accent-text` を使う。`-500` は面・枠・アイコン用。

  | 組み合わせ | 比 | 可否 |
  |---|---|---|
  | `#2E8B57` on `#E4F3BA`（success-500 on lime-100） | 3.60 | ✗ |
  | `#1F6B3F` on `#E4F3BA`（success-text on lime-100） | 5.51 | ✓ |
  | `#E2467C` on `#FCE1EA`（hibiscus-500 on hibiscus-100） | 3.17 | ✗ |
  | `#B3164F` on `#FCE1EA`（accent-text on hibiscus-100） | 5.44 | ✓ |
- 濃緑面（ヘッダー・主ボタン）の文字は `#FFFFFF` または `--durian-cream-50`。
- **グラデーションは使わない。すべてベタ塗り。** 詳細は `docs/design.md`。
