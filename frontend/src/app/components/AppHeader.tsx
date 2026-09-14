'use client';

import Image from 'next/image';

/**
 * ヘッダー。検索コントロールはすべてここに集約する（designs の .pen「1 検索トップ」）。
 * 以前はボトムシートの中にあり、390x844 では結果カードが 1 枚も見えなかった。
 *
 * pt はセーフエリア分を足す。iOS でノッチ / Dynamic Island に潜らせない
 * （Web では env() が 0 になるだけ）。→ docs/design.md 6節
 */
export default function AppHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="shrink-0 z-40 bg-primary-deepest rounded-b-[24px] px-4 pb-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] md:px-6">
      {/*
        ブランドロックアップ。マークがワードマークの "D" を兼ねるので、
        表示テキストは "urian Map"、読み上げは aria-label で "Durian Map" にする。
      */}
      <div className="flex items-center gap-1" aria-label="Durian Map" role="img">
        <Image src="/logo.svg" alt="" width={56} height={56} priority className="h-12 w-12 shrink-0" />
        <span aria-hidden className="font-display text-2xl md:text-3xl font-bold text-cream leading-none -ml-1">
          urian Map
        </span>
      </div>

      {children}
    </header>
  );
}
