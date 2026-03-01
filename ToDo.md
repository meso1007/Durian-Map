# Durian Map - ToDo

## 優先度：高

- [ ] **Google Maps JavaScript API の有効化**
  - Google Cloud Console でAPI有効化
  - APIキーのHTTPリファラー制限を設定（本番前に必須）

- [ ] **マーカー画像の差し替え**
  - `frontend/public/marker.png` と `frontend/public/marker-selected.png` を用意して配置
  - サイズは `MapView.tsx` の先頭定数で調整

## 優先度：中

- [ ] **UIの改善**
  - カフェカードのデザインをさらに洗練させる
  - モバイルでの操作感をブラッシュアップ（スワイプでリスト展開など）
  - 検索エリア入力のオートコンプリート

- [ ] **チェーン店リストのメンテナンス**
  - 漏れているチェーンを継続的に追加
  - `backend/src/index.ts` の `chainCafeNames` / `chainCafeDomains` を更新

- [ ] **エラーハンドリングの改善**
  - APIエラー時にトースト通知などで明示
  - 現在地取得失敗時のフィードバック改善

## 優先度：低

- [ ] **カフェ詳細情報の拡充**
  - Google Places API から営業時間・評価・写真を取得して表示

- [ ] **シェア機能**
  - 気に入ったカフェをLINE・Xなどにシェアするボタン

- [ ] **デプロイ**
  - フロントエンド：Vercel
  - バックエンド：Railway / Render など

- [ ] **パフォーマンス改善**
  - 検索結果のキャッシュ（同じエリアの再検索を高速化）
