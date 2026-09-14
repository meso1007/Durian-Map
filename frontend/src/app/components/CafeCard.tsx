'use client';

import Image from 'next/image';
import { memo } from 'react';

import { getCafePhotoUrl } from '@/lib/api';
import type { Cafe } from '@/lib/api';
import { getOpeningTime, openStatusBorder } from '@/lib/cafe';
import { formatDistance } from '@/lib/geo';
import type { SavedStatus } from '@/lib/storage';

import { CheckIcon, ClockIcon, CupIcon, StarIcon } from './icons';

type Props = {
  cafe: Cafe;
  distance: number | null;
  isSelected: boolean;
  /** 保存済みなら状態。未保存なら undefined。 */
  savedStatus?: SavedStatus;
  onSelect: (id: string) => void;
};

/**
 * カフェ 1 件のカード。カード全体がタップ領域で、カード内に別のボタンは置かない
 * （docs/design.md 5節）。
 *
 * 20 件並ぶので memo する。入力 1 文字ごとの再描画を避けるため、
 * onSelect は id を受け取る形にしてカードごとのクロージャを作らない。
 */
function CafeCard({ cafe, distance, isSelected, savedStatus, onSelect }: Props) {
  const photoUrl = getCafePhotoUrl(cafe);
  const openingTime = getOpeningTime(cafe.weekdayDescriptions);

  return (
    <button
      type="button"
      data-id={cafe.id}
      onClick={() => onSelect(cafe.id)}
      aria-pressed={isSelected}
      className={`w-full text-left shrink-0 rounded-[20px] border-2 p-2.5 flex gap-3 items-center shadow-card bg-surface ${isSelected ? 'border-primary bg-surface-sunken' : openStatusBorder(cafe.openNow)}`}
    >
      {/* サムネイル 72x72 / 角丸 16px（.pen の Cafe Card） */}
      <div className="w-[72px] h-[72px] shrink-0 rounded-2xl overflow-hidden bg-surface-sunken flex items-center justify-center text-text-muted">
        {photoUrl ? (
          <Image src={photoUrl} alt="" width={72} height={72} unoptimized loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <CupIcon className="w-7 h-7" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold leading-[1.4] text-text line-clamp-2">{cafe.name}</h3>

        {/*
          Meta 行（.pen の Cafe Card）: ★ 4.6 (128) · 320m · 13:00-
          営業中バッジは新デザインで廃止された。営業状態はカードの枠線と地図ピンの枠が担う。
        */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1.5 text-xs text-text-muted">
          {cafe.rating != null && (
            <span className="inline-flex items-center gap-1">
              <StarIcon className="w-3.5 h-3.5 text-star" />
              <span className="num text-sm font-bold text-text">{cafe.rating.toFixed(1)}</span>
              {cafe.userRatingCount != null && <span className="num">({cafe.userRatingCount})</span>}
            </span>
          )}

          {distance != null && (
            <>
              {cafe.rating != null && <span aria-hidden>·</span>}
              <span className="num">{formatDistance(distance)}</span>
            </>
          )}

          {openingTime && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                <span className="num">{openingTime}-</span>
              </span>
            </>
          )}
        </div>

        {/* 訪問済みバッジは住所と同じ行に置く。住所を消してしまうと店を特定しにくくなる。 */}
        <p className="flex items-center gap-1.5 text-xs leading-[1.5] text-text-muted mt-1">
          {savedStatus === 'visited' && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold leading-none text-success-text">
              <CheckIcon />
              訪問済み
            </span>
          )}
          <span className="min-w-0 truncate">{cafe.address}</span>
        </p>
      </div>
    </button>
  );
}

export default memo(CafeCard);
