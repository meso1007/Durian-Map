'use client';

import { memo } from 'react';

import { getCafePhotoUrl } from '@/lib/api';
import type { Cafe } from '@/lib/api';
import { formatAddress, getOpenStatusLabel } from '@/lib/cafe';
import { formatDistance, formatWalkingMinutes } from '@/lib/geo';
import { setHoveredCafe } from '@/lib/hoverStore';
import type { SavedStatus } from '@/lib/storage';

import { BookmarkIcon, CheckIcon, CupIcon, StarIcon } from './icons';

type Props = {
  cafe: Cafe;
  distance: number | null;
  /** 保存済みなら状態。未保存なら undefined。 */
  savedStatus?: SavedStatus;
  /** 一覧の何番目か。出現をずらすのに使う（先頭 8 枚まで）。 */
  index: number;
  onSelect: (id: string) => void;
};

/**
 * カフェ 1 件のカード。カード全体がタップ領域で、カード内に別のボタンは置かない
 * （docs/design.md 5節）。押すと同じ場所で詳細に入れ替わる。
 *
 * 20 件並ぶので memo する。onSelect は id を受け取る形にしてカードごとのクロージャを作らない。
 */
function CafeCard({ cafe, distance, savedStatus, index, onSelect }: Props) {
  const photoUrl = getCafePhotoUrl(cafe, 200);
  const openStatus = getOpenStatusLabel(cafe);

  return (
    <button
      type="button"
      data-id={cafe.id}
      onClick={() => onSelect(cafe.id)}
      // 地図のピンと対応づける。タッチでは hover が残り続けるので、マウスのときだけ。
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHoveredCafe(cafe.id);
      }}
      onPointerLeave={() => setHoveredCafe(null)}
      onFocus={() => setHoveredCafe(cafe.id)}
      onBlur={() => setHoveredCafe(null)}
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
      className="group flex w-full shrink-0 animate-rise items-center gap-3.5 rounded-[20px] p-2 text-left transition-colors duration-[var(--dm-duration-fast)] hover:bg-surface-sunken active:bg-surface-sunken"
    >
      {/* 写真 88x88 / 角丸 16px */}
      <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-sunken text-text-muted">
        {photoUrl ? (
          // 写真は Worker の /api/photo 経由（署名付き）。最適化サーバーは無いので img をそのまま使う。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            width={88}
            height={88}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-[var(--dm-duration-slow)] ease-out group-hover:scale-105"
          />
        ) : (
          <CupIcon className="h-7 w-7" />
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-base font-bold leading-[1.4] text-text">{cafe.name}</h3>

          {savedStatus && (
            <span
              className={`mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[11px] font-bold leading-none ${savedStatus === 'visited' ? 'bg-success-soft text-success-text' : 'bg-accent-soft text-accent-text'}`}
            >
              {savedStatus === 'visited' ? <CheckIcon /> : <BookmarkIcon filled className="h-2.5 w-2.5" />}
              {savedStatus === 'visited' ? '訪問済み' : '行きたい'}
            </span>
          )}
        </div>

        {/* 評価と距離。いずれも値が取れたときだけ出す。 */}
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-text-muted">
          {cafe.rating != null && (
            <span className="inline-flex items-center gap-1">
              <StarIcon className="h-3.5 w-3.5 text-star" />
              <span className="num text-sm font-bold text-text">{cafe.rating.toFixed(1)}</span>
              {cafe.userRatingCount != null && <span className="num">({cafe.userRatingCount})</span>}
            </span>
          )}

          {distance != null && (
            <>
              {cafe.rating != null && <span aria-hidden>·</span>}
              <span>
                <span className="num">{formatDistance(distance)}</span>
                <span className="ml-1">
                  徒歩<span className="num">{formatWalkingMinutes(distance)}</span>
                </span>
              </span>
            </>
          )}
        </div>

        {/*
          営業状態。「いつまで開いているか」で出す（単なる「営業中」より行くかどうかの判断に効く）。
          時刻はサーバーがレスポンス時に JST で計算した値（closesAt / opensAt）。
        */}
        {cafe.openNow !== undefined && (
          <p className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${cafe.openNow ? 'text-success-text' : 'text-accent-text'}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cafe.openNow ? 'bg-success' : 'bg-accent'}`} />
            {cafe.openNow ? '営業中' : '営業時間外'}
            {openStatus && (
              <span className="font-normal text-text-muted">
                <span className="num">{openStatus.value}</span>
                {openStatus.suffix}
              </span>
            )}
          </p>
        )}

        <p className="mt-1 truncate text-xs leading-[1.5] text-text-muted">{formatAddress(cafe.address)}</p>
      </div>
    </button>
  );
}

export default memo(CafeCard);
