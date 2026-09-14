'use client';

/**
 * 営業状態のバッジ。状態バッジは押せないので枠線・影・ホバーを付けない
 * （docs/design.md 5節）。文字色は淡色地で 4.5:1 を満たす -text 系を使う。
 *
 * `plain` は .pen の詳細画面に合わせた地色なしの形。
 * 地図に重なるカードでは背景が読めないので、そちらは淡色地のピルのままにする。
 */
export default function OpenStatusBadge({ openNow, plain = false }: { openNow?: boolean; plain?: boolean }) {
  if (openNow === undefined) {
    return null;
  }

  const tone = openNow ? 'text-success-text' : 'text-accent-text';
  const surface = plain ? '' : openNow ? 'bg-success-soft px-2 py-1' : 'bg-accent-soft px-2 py-1';

  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full text-[11px] font-bold leading-none ${tone} ${surface}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${openNow ? 'bg-success' : 'bg-accent'}`} />
      {openNow ? '営業中' : '準備中'}
    </span>
  );
}
