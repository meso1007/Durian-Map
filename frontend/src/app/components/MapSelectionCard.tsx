'use client';

import Image from 'next/image';

import { getCafePhotoUrl } from '@/lib/api';
import type { Cafe } from '@/lib/api';
import { formatDistance } from '@/lib/geo';

import OpenStatusBadge from './OpenStatusBadge';
import { CloseIcon, CupIcon, StarIcon } from './icons';

/** 地図のピンから選んだときに地図の上へ重ねるカード（モバイル）。 */
export default function MapSelectionCard({
  cafe,
  distance,
  onClose,
}: {
  cafe: Cafe;
  distance: number | null;
  onClose: () => void;
}) {
  const photoUrl = getCafePhotoUrl(cafe);

  return (
    <section className="rounded-2xl border border-border bg-surface p-3 shadow-card">
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-sunken flex items-center justify-center text-text-muted">
          {photoUrl ? (
            <Image src={photoUrl} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" />
          ) : (
            <CupIcon className="w-7 h-7" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 min-w-0 text-base font-bold leading-[1.4] text-text line-clamp-1">{cafe.name}</h3>
            <OpenStatusBadge openNow={cafe.openNow} />
            <button
              type="button"
              onClick={onClose}
              aria-label="選択を解除"
              className="h-11 w-11 -mr-2 -mt-2 shrink-0 flex items-center justify-center rounded-full text-text-muted"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            {cafe.rating != null && (
              <span className="inline-flex items-center gap-1">
                <StarIcon className="w-3.5 h-3.5 text-star" />
                <span className="num text-sm font-bold text-text">{cafe.rating.toFixed(1)}</span>
                {cafe.userRatingCount != null && <span className="num">({cafe.userRatingCount})</span>}
              </span>
            )}

            {distance != null && (
              <>
                {cafe.rating != null && <span aria-hidden>・</span>}
                <span className="num">{formatDistance(distance)}</span>
              </>
            )}
          </div>

          <p className="mt-1 text-sm leading-[1.6] text-text-muted line-clamp-1">{cafe.address}</p>
        </div>
      </div>
    </section>
  );
}
