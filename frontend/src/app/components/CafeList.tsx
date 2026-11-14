'use client';

import type { Cafe, Coordinates } from '@/lib/api';
import { getDistanceMeters } from '@/lib/geo';
import type { SavedStatus } from '@/lib/storage';

import CafeCard from './CafeCard';
import EmptyState from './EmptyState';
import type { EmptyCopy } from './EmptyState';

type Props = {
  cafes: Cafe[];
  isLoading: boolean;
  currentLocation: Coordinates | null;
  getSavedStatus: (cafeId: string) => SavedStatus | undefined;
  onSelect: (id: string) => void;
  /** 0 件のときの表示。状況（絞り込み過多 / 保存なし / 失敗）で変える。 */
  empty: EmptyCopy;
  /** 検索のたびに変わる値。一覧を作り直して、出現の動きをやり直す合図にする。 */
  listKey: string;
  listRef: React.RefObject<HTMLDivElement | null>;
};

export default function CafeList({
  cafes,
  isLoading,
  currentLocation,
  getSavedStatus,
  onSelect,
  empty,
  listKey,
  listRef,
}: Props) {
  return (
    <div
      ref={listRef}
      aria-busy={isLoading}
      className="dm-scroll flex-1 overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-4"
    >
      {/*
        件数の読み上げ。スケルトンは aria-hidden なので、読み上げ環境には
        ここだけが「検索中」「N 件見つかりました」として届く。
      */}
      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? '検索中' : `${cafes.length}件見つかりました`}
      </span>

      {isLoading && (
        <div className="animate-pulse" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3.5 p-2">
              <div className="h-[88px] w-[88px] shrink-0 rounded-2xl bg-surface-sunken" />
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
        <div key={listKey} className="flex flex-col gap-0.5">
          {cafes.map((cafe, index) => (
            <CafeCard
              key={cafe.id}
              cafe={cafe}
              index={index}
              distance={getDistanceMeters(currentLocation, cafe)}
              savedStatus={getSavedStatus(cafe.id)}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {!isLoading && cafes.length === 0 && <EmptyState {...empty} />}
    </div>
  );
}
