'use client';

import { useRef } from 'react';

export type SheetState = 'half' | 'full';

const SWIPE_THRESHOLD_PX = 50;

/**
 * モバイルのボトムシート。PC では右カラムになり、ハンドルは出さない。
 *
 * 高さは % で持つ（dvh と vh を混ぜると iOS で全開時に地図が消える）。
 */
export default function BottomSheet({
  state,
  onChange,
  children,
}: {
  state: SheetState;
  onChange: (next: SheetState) => void;
  children: React.ReactNode;
}) {
  const touchStartY = useRef(0);

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 bg-surface shadow-card rounded-t-[30px] flex flex-col transition-[height] duration-300 ease-out
        md:static md:w-[440px] md:h-full md:rounded-none md:shadow-none md:border-l md:border-border
        ${state === 'full' ? 'h-[88%]' : 'h-[52%]'}`}
    >
      {/* ドラッグハンドル（モバイル専用） */}
      <button
        type="button"
        aria-label={state === 'half' ? 'リストを広げる' : 'リストを縮める'}
        className="w-full flex justify-center items-center h-6 shrink-0 md:hidden"
        onTouchStart={(event) => {
          touchStartY.current = event.touches[0].clientY;
        }}
        onTouchEnd={(event) => {
          const dy = event.changedTouches[0].clientY - touchStartY.current;
          if (dy < -SWIPE_THRESHOLD_PX) onChange('full');
          else if (dy > SWIPE_THRESHOLD_PX) onChange('half');
        }}
        onClick={() => onChange(state === 'half' ? 'full' : 'half')}
      >
        <span className="w-11 h-[5px] rounded-full bg-border pointer-events-none" />
      </button>

      <div className="flex-1 flex flex-col overflow-hidden px-4 md:px-5">{children}</div>
    </div>
  );
}
