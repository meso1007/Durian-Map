'use client';

import type { Cafe, Coordinates } from '@/lib/api';
import { getDistanceMeters } from '@/lib/geo';
import type { SavedStatus } from '@/lib/storage';

import CafeCard from './CafeCard';
import EmptyState from './EmptyState';

type Props = {
  cafes: Cafe[];
  isLoading: boolean;
  currentLocation: Coordinates | null;
  selectedId: string | null;
  getSavedStatus: (cafeId: string) => SavedStatus | undefined;
  onSelect: (id: string) => void;
  /** 0 件のときの文言。状況（未検索 / 絞り込み過多 / 保存なし）で変える。 */
  empty: { title: string; description: string };
  listRef: React.RefObject<HTMLDivElement | null>;
};

export default function CafeList({
  cafes,
  isLoading,
  currentLocation,
  selectedId,
  getSavedStatus,
  onSelect,
  empty,
  listRef,
}: Props) {
  return (
    <div ref={listRef} className="flex-1 overflow-y-auto pb-4 flex flex-col gap-2 scroll-smooth">
      {isLoading && (
        <div className="flex flex-col gap-2 animate-pulse" aria-hidden>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[92px] rounded-[20px] bg-surface-sunken shrink-0" />
          ))}
        </div>
      )}

      {!isLoading &&
        cafes.map((cafe) => (
          <CafeCard
            key={cafe.id}
            cafe={cafe}
            distance={getDistanceMeters(currentLocation, cafe)}
            isSelected={cafe.id === selectedId}
            savedStatus={getSavedStatus(cafe.id)}
            onSelect={onSelect}
          />
        ))}

      {!isLoading && cafes.length === 0 && <EmptyState title={empty.title} description={empty.description} />}
    </div>
  );
}
