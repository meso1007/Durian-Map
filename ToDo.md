# Durian Map - ToDo

## 優先度：高

- [ x ] **Google Maps JavaScript API の有効化**
  - Google Cloud Console でAPI有効化
  - APIキーのHTTPリファラー制限を設定（本番前に必須）

- [ x ] **マーカー画像の差し替え**
  - `frontend/public/marker.svg` と `frontend/public/marker-selected.svg` を用意して配置
  - サイズは `MapView.tsx` の先頭定数で調整

## 優先度：中

- [ x ] **UIの改善**
  - カフェカードのデザインをさらに洗練させる
  - モバイルでの操作感をブラッシュアップ（スワイプでリスト展開など）
  - 検索エリア入力のオートコンプリート

- [ x ] **チェーン店リストのメンテナンス**
  - 漏れているチェーンを継続的に追加
  - `backend/src/index.ts` の `chainCafeNames` / `chainCafeDomains` を更新

- [ x ] **エラーハンドリングの改善**
  - APIエラー時にトースト通知などで明示
  - 現在地取得失敗時のフィードバック改善

## 優先度：低

- [ x ] **カフェ詳細情報の拡充**
  - Google Places API から営業時間・評価・写真を取得して表示

- [ x ] **シェア機能**
  - 気に入ったカフェをLINE・Xなどにシェアするボタン

- [ x ] **デプロイ**
  - フロントエンド：Vercel
  - バックエンド：Render (render.yaml設定済)

- [ x ] **パフォーマンス改善**
  - 検索結果のキャッシュ（同じエリアの再検索を高速化）
