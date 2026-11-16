'use client';

import { useState } from 'react';

/**
 * 店舗写真。読み込めたら不透明度だけを上げて出す（出た瞬間に絵が跳ねないように）。
 * 読み込みに失敗したら `fallback` に倒す — 壊れた画像のアイコンは出さない。
 *
 * 写真は Worker の /api/photo 経由（署名付き）で、Next の画像最適化サーバーは無い
 * （静的書き出し）。そのため next/image ではなく img をそのまま使う。
 */
export default function Photo({
  src,
  alt,
  eager = false,
  className = '',
  fallback,
}: {
  src: string | null;
  alt: string;
  /** 画面に入ってすぐ見える写真（詳細の大きな写真）は遅延させない。 */
  eager?: boolean;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  if (!src || status === 'failed') return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      // キャッシュ済みの写真は onLoad より先に complete になっていることがある。
      ref={(element) => {
        if (element?.complete && element.naturalWidth > 0) setStatus('loaded');
      }}
      onLoad={() => setStatus('loaded')}
      onError={() => setStatus('failed')}
      className={`h-full w-full object-cover transition-opacity duration-[var(--dm-duration-slow)] ease-out ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  );
}
