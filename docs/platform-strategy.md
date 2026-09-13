# プラットフォーム方針（Web / iOS）

最終更新: 2026-09-13

## 結論

**iOS アプリと Web アプリは「別々に作らない」。ロジック（API）は 1 つ、UI だけ 2 つ**にする。
当面は **Web（Next.js）を正とし、iOS は Capacitor でその Web をネイティブの殻に包む**。
React Native（Expo）でのフルネイティブ化は、後述の「C に移る条件」を満たしてから着手する。

## 現状のコードベース（2026-09-13 時点）

```
frontend/
  src/app/api/search/route.ts    # 314行 アプリの頭脳（Places API 呼び出し + チェーン店判定）
  src/app/page.tsx               # 966行 画面本体
  src/app/components/MapView.tsx # 366行 Google Maps
  public/manifest.json           # PWA マニフェスト（導入済み）
designs/durian-map-tropical.pen  # デザイン案（.pen）
docs/design.md                   # デザイン規約 ← UI を触る人はこれを読む
docs/design-tokens.md            # カラートークン（色の正）
```

> 注意: `README.md` には `backend/` ディレクトリ（Hono / port 8080）の記述が残っているが、
> **現在バックエンドは存在しない**。検索 API は Next.js の Route Handler
> (`frontend/src/app/api/search/route.ts`) に統合済み。README は要更新。

**重要な前提**: チェーン店判定ロジックはすべてサーバー側（Route Handler）にある。
つまり iOS からも同じ HTTP エンドポイントを叩くだけで再利用できる。**ここを二重実装しないこと。**

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

- [ ] **1. API を「独立したエンドポイント」として扱う**
      `/api/search` を Next.js の内部実装に依存させない。クライアント（Web / iOS）からは
      `NEXT_PUBLIC_API_BASE_URL` のような設定可能なベース URL 経由で叩く。
      → `page.tsx` 内の相対パス fetch を、ベース URL を挟む薄い関数（`lib/api.ts`）に集約する。
- [ ] **2. localStorage 依存を抽象化する**
      保存済みカフェが `localStorage` 直書きのままだと iOS 側と共有できない。
      `lib/storage.ts` のようなラッパーを 1 枚挟み、後からネイティブストレージやサーバー保存に
      差し替えられるようにする。**UI コンポーネントから `localStorage` を直接呼ばない。**
- [ ] **3. Capacitor 導入**（上記 1・2 の後）

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
