'use client';

import type { Cafe, Coordinates } from '@/lib/api';
import { getDistanceMeters } from '@/lib/geo';
import type { SavedStatus } from '@/lib/storage';
import { useNow } from '@/hooks/useNow';

import CafeCard from './CafeCard';
import EmptyState from './EmptyState';
import type { EmptyCopy } from './EmptyState';

type Props = {
  /** 一覧の見出しと絞り込み。一覧と一緒にスクロールさせる。 */
  header: React.ReactNode;
  cafes: Cafe[];
  isLoading: boolean;
  currentLocation: Coordinates | null;
  getSavedStatus: (cafeId: string) => SavedStatus | undefined;
  /** 保存の状態バッジを出すか。保存の一覧を状態で絞り込んでいる間は、全部同じなので出さない。 */
  showSavedBadge: boolean;
  onSelect: (id: string) => void;
  /** 0 件のときの表示。状況（絞り込み過多 / 保存なし / 失敗）で変える。 */
  empty: EmptyCopy;
  /** 検索のたびに変わる値。一覧を作り直して、出現の動きをやり直す合図にする。 */
  listKey: string;
  listRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * 一覧のスクロール領域。
 *
 * 見出しと絞り込みもこの中に入れてある。固定にすると、画面が低いとき（横向き・400% 拡大）に
 * 固定部分だけで高さを使い切り、カードが 1 枚も見えなくなる（WCAG 1.4.10）。
 */
export default function CafeList({
  header,
  cafes,
  isLoading,
  currentLocation,
  getSavedStatus,
  showSavedBadge,
  onSelect,
  empty,
  listKey,
  listRef,
}: Props) {
  const now = useNow();

  return (
    <div
      ref={listRef}
      // 詳細を閉じたとき、戻り先のカードがもう無ければここへフォーカスを返す（useMapSelection）。
      tabIndex={-1}
      className="dm-scroll flex-1 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))] focus-visible:outline-none"
    >
      {header}

      {isLoading && (
        <div className="animate-pulse px-3 md:px-4" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="h-[88px] w-[88px] shrink-0 rounded-lg bg-surface-sunken" />
              <div className="flex-1 space-y-2.5">
                <div className="h-4 w-3/5 rounded-full bg-surface-sunken" />
                <div className="h-3 w-2/5 rounded-full bg-surface-sunken" />
                <div className="h-3 w-4/5 rounded-full bg-surface-sunken" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && cafes.length > 0 && (
        <ul key={listKey} className="flex flex-col gap-0.5 px-3 pt-1 md:px-4">
          {cafes.map((cafe, index) => (
            <li key={cafe.id}>
              <CafeCard
                cafe={cafe}
                index={index}
                now={now}
                distance={getDistanceMeters(currentLocation, cafe)}
                savedStatus={showSavedBadge ? getSavedStatus(cafe.id) : undefined}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && cafes.length === 0 && <EmptyState {...empty} />}
    </div>
  );
}
