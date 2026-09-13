# プラットフォーム方針（Web / iOS）

最終更新: 2026-09-13

## 結論

**iOS アプリと Web アプリは「別々に作らない」。ロジック（API）は 1 つ、UI だけ 2 つ**にする。
当面は **Web（Next.js）を正とし、iOS は Capacitor でその Web をネイティブの殻に包む**。
React Native（Expo）でのフルネイティブ化は、後述の「C に移る条件」を満たしてから着手する。

## 現状のコードベース（2026-09-13 時点）

```
backend/                         # Cloudflare Workers（Hono）← API の正
  src/chains.ts                  # チェーン店ブロックリストと判定ロジック（正）
  src/index.ts                   # ルーティング / CORS / レート制限 / バリデーション
  src/places.ts                  # Google Places クライアント、写真取得
  src/cache.ts  src/ratelimit.ts # KV キャッシュ / レート制限
frontend/
  src/app/page.tsx               # 画面本体
  src/app/components/MapView.tsx # Google Maps
  public/manifest.json           # PWA マニフェスト（導入済み）
designs/durian-map-tropical.pen  # デザイン案（.pen）
docs/design.md                   # デザイン規約 ← UI を触る人はこれを読む
docs/design-tokens.md            # カラートークン（色の正）
```

**重要な前提**: チェーン店判定ロジックはすべてサーバー側（`backend/src/chains.ts`）にある。
iOS からも同じ HTTP エンドポイントを叩くだけで再利用できる。**ここを二重実装しないこと。**

## 3 つの選択肢と採用理由

| | 作り方 | 追加コスト | App Store | 判定 |
|---|---|---|---|---|
| A. PWA のみ | 今のまま。ホーム画面に追加 | ほぼ 0 | ✗ 出せない | 補助的に維持 |
| **B. Capacitor** | **Next.js を WebView でラップ** | **小（数日）** | ✓ | **← 採用** |
| C. Expo / React Native | iOS 用 UI を別途実装（ロジックは共有） | 大（UI 全書き直し） | ✓ ネイティブ品質 | 将来の選択肢 |

B を採る理由:

- このアプリの中核は「地図 + リスト + 検索」。Capacitor（WebView 内の Google Maps JS）でも実用的な体験になる。
- 966 行の `page.tsx` を今 React Native へ移植するのは、MVP 段階では明らかに過剰投資。
- A（PWA）だけでは App Store に出せない。配布チャネルを確保したい。

## いまやっておく準備（C への移行コストを下げる）

- [x] **1. API を「独立したエンドポイント」として切り出す** — 完了
      Cloudflare Workers（`backend/`）にデプロイ済み: https://durian-map-api.itto-hp.workers.dev
      Next.js の `/api/search` Route Handler は廃止し、Workers に一本化した。
      フロントは `NEXT_PUBLIC_API_BASE_URL` 経由で叩く（`frontend/src/lib/api.ts`）。
- [ ] **2. localStorage 依存を抽象化する**
      保存済みカフェが `localStorage` 直書きのままだと iOS 側と共有できない。
      `lib/storage.ts` のようなラッパーを 1 枚挟み、後からネイティブストレージやサーバー保存に
      差し替えられるようにする。**UI コンポーネントから `localStorage` を直接呼ばない。**
- [ ] **3. Capacitor 導入**（上記 2 の後）

## デプロイ先

| レイヤ | 環境 | URL |
|---|---|---|
| API | Cloudflare Workers（`durian-map-api`） | https://durian-map-api.itto-hp.workers.dev |
| フロント | 未デプロイ（Vercel 想定） | — |

**フロントを本番デプロイしたら、その URL を `backend/wrangler.jsonc` の `ALLOWED_ORIGINS` に
追加して再デプロイすること。** 忘れると本番で CORS に弾かれる。

## やらないこと

- iOS 用に Swift でチェーン店判定を書き直す → **禁止**。ロジックの正はサーバー側 1 箇所。
- Web と iOS でデザイントークンを別管理する → **禁止**。`docs/design-tokens.md` が唯一の正。
- 現時点で React Native への移植を始める → 早すぎる。下記の条件を満たすまで待つ。

## C（React Native）に移る条件

次のいずれかが**実際に必要になった**時点で再検討する（「いつか使うかも」では動かない）:

- 位置情報のバックグラウンド取得（例: 近くに個人カフェがあったら通知）
- オフラインでの地図閲覧
- カメラ連携（店の写真を撮って保存）
- WebView 由来の描画・スクロール性能が体感で問題になった場合

## 作業分担のときの原則

- **サーバー側ロジック**（`api/search/route.ts`、チェーン店リスト）を触る人と、
  **UI**（`page.tsx`、`MapView.tsx`）を触る人を分けるとコンフリクトしにくい。
- UI を触る前に必ず `docs/design.md` を読むこと。
