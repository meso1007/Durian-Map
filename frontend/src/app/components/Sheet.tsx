'use client';

import { useEffect, useState } from 'react';

import { useSheetDrag } from '@/hooks/useSheetDrag';
import type { SheetSnap } from '@/lib/sheet';

const SNAP_LABEL: Record<SheetSnap, string> = {
  peek: '閉じています',
  half: '半分まで開いています',
  full: '全面に開いています',
};

/**
 * 本体の面。モバイルでは 3 段階のボトムシート、PC では動かないパネルになる。
 * 位置の決め方は globals.css の `.dm-sheet` を参照。→ docs/design.md 4.5節
 *
 * `header` はシートの頭（つかめる領域）。peek の段ではここだけが見える。
 */
export default function Sheet({
  snap,
  heights,
  draggable,
  onSnapChange,
  header,
  children,
}: {
  snap: SheetSnap;
  heights: Record<SheetSnap, number>;
  /** モバイルのときだけ true。 */
  draggable: boolean;
  onSnapChange: (next: SheetSnap) => void;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const { sheetRef, dragProps, handleProps } = useSheetDrag({ snap, heights, enabled: draggable, onSnapChange });

  // 中身の高さは「止まり終わった段」に合わせる。縮むときに先に高さを詰めると、
  // シートが下がりきるまでの間、下側に何も無い面が見えてしまう。広がるときは先に伸ばす。
  const [settledSnap, setSettledSnap] = useState(snap);
  const bodySnap = heights[snap] >= heights[settledSnap] ? snap : settledSnap;

  // transitionend が来ない場合の保険（PC から幅を縮めた直後、動きを減らす設定など）。
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledSnap(snap), 600);
    return () => window.clearTimeout(timer);
  }, [snap]);

  return (
    <div
      ref={sheetRef}
      data-snap={snap}
      data-body-snap={bodySnap}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'transform') setSettledSnap(snap);
      }}
      className="dm-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-[20px] bg-surface shadow-float md:static md:min-h-0 md:flex-1 md:rounded-t-none md:rounded-b-[20px]"
    >
      <div {...dragProps} className="shrink-0 touch-none select-none md:touch-auto md:select-auto">
        {/* ハンドル。見た目は細い棒だが、押せる領域は行の幅いっぱいに取る。 */}
        <button
          type="button"
          {...handleProps}
          aria-label={`一覧の大きさを変える（${SNAP_LABEL[snap]}）`}
          aria-expanded={snap !== 'peek'}
          className="flex h-6 w-full cursor-grab items-end justify-center focus-visible:-outline-offset-2 active:cursor-grabbing md:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-border" />
        </button>

        {header}
      </div>

      {/* 閉じている段では中身は画面の外にある。見えないものにフォーカスや読み上げが行かないようにする。 */}
      <div inert={draggable && snap === 'peek'} className="relative flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
