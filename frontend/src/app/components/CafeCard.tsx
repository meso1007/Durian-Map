'use client';

import { memo } from 'react';

import { getCafePhotoUrl } from '@/lib/api';
import type { Cafe } from '@/lib/api';
import { formatAddress, getMinutesUntilClose, getOpenStatusLabel } from '@/lib/cafe';
import { formatDistance, formatWalkingMinutes } from '@/lib/geo';
import { setHoveredCafe } from '@/lib/hoverStore';
import type { SavedStatus } from '@/lib/storage';

import { BookmarkIcon, CheckIcon, CupIcon, StarIcon } from './icons';
import Photo from './Photo';
import TodayBar from './TodayBar';

type Props = {
  cafe: Cafe;
  distance: number | null;
  /** 保存済みなら状態。未保存なら undefined（バッジを出さない）。 */
  savedStatus?: SavedStatus;
  /** いまの時刻（ms）。残り時間の計算に使う。親が 1 分ごとに更新する。 */
  now: number;
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
function CafeCard({ cafe, distance, savedStatus, now, index, onSelect }: Props) {
  const photoUrl = getCafePhotoUrl(cafe, 200);
  const openStatus = getOpenStatusLabel(cafe);

  // 閉店まで 1 時間を切っていたら、時刻ではなく残り時間で伝える。
  const minutesLeft = cafe.openNow ? getMinutesUntilClose(cafe.closesAt, new Date(now)) : null;
  const closingSoon = minutesLeft !== null && minutesLeft <= 60;

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
      className="group flex w-full shrink-0 animate-rise items-center gap-3 rounded-2xl p-2 text-left transition-colors duration-[var(--dm-duration-fast)] hover:bg-surface-sunken active:bg-surface-sunken"
    >
      {/* 写真 88x88 / 角丸 16px */}
      <div data-photo className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-sunken text-text-muted">
        <Photo
          src={photoUrl}
          alt=""
          fallback={<CupIcon className="h-7 w-7" />}
        />
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start gap-2">
          {/* button の中は見出しとして公開されないので、h3 ではなく span にする。 */}
          <span className="font-display line-clamp-2 min-w-0 flex-1 text-base font-medium leading-[1.4] text-text">{cafe.name}</span>

          {savedStatus && (
            <span
              className={`mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-xs font-medium leading-none ${savedStatus === 'visited' ? 'bg-success-soft text-success-text' : 'bg-accent-soft text-accent-text'}`}
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
              <StarIcon className="h-4 w-4 text-star" />
              <span className="sr-only">評価</span>
              <span className="num text-sm font-bold text-text">{cafe.rating.toFixed(1)}</span>
              {cafe.userRatingCount != null && (
                <span className="num">
                  ({cafe.userRatingCount}
                  <span className="sr-only">件のクチコミ</span>)
                </span>
              )}
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
          <p className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${cafe.openNow && !closingSoon ? 'text-success-text' : 'text-accent-text'}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cafe.openNow && !closingSoon ? 'bg-success' : 'bg-accent'}`} />
            {closingSoon ? (
              <span>
                あと<span className="num">{minutesLeft}</span>分で閉店
              </span>
            ) : cafe.openNow ? (
              '営業中'
            ) : (
              '営業時間外'
            )}
            {openStatus && !closingSoon && (
              <span className="font-normal text-text-muted">
                <span className="num">{openStatus.value}</span>
                {openStatus.suffix}
              </span>
            )}
          </p>
        )}

        {/*
          今日の営業時間の帯（6 時 → 24 時）。営業時間が取れない店だけ、代わりに住所を出す。
          住所は詳細に必ず出る。一覧では「いつ開いているか」のほうが店どうしを見比べやすい。
        */}
        {cafe.weekdayDescriptions && cafe.weekdayDescriptions.length >= 7 ? (
          <TodayBar weekdayDescriptions={cafe.weekdayDescriptions} now={now} />
        ) : (
          <p className="mt-1 truncate text-xs leading-[1.5] text-text-muted">{formatAddress(cafe.address)}</p>
        )}
      </div>
    </button>
  );
}

export default memo(CafeCard);
