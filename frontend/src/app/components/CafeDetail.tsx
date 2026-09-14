'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

import { getCafePhotoUrl } from '@/lib/api';
import type { Cafe } from '@/lib/api';
import {
  getCafeDomain,
  getCafeMapUrl,
  getCategoryLabel,
  getOpenStatusLabel,
  getTodayHours,
  parseCafeWebsite,
} from '@/lib/cafe';
import { formatDistance, formatWalkingMinutes } from '@/lib/geo';
import { shareUrl } from '@/lib/share';
import type { SavedStatus } from '@/lib/storage';

import OpenStatusBadge from './OpenStatusBadge';
import {
  BookmarkIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  LinkIcon,
  LocationIcon,
  PhoneIcon,
  ShareIcon,
  StarIcon,
} from './icons';

type Props = {
  cafe: Cafe;
  distance: number | null;
  /** 保存済みなら状態。未保存なら undefined。 */
  savedStatus?: SavedStatus;
  /** 共有する URL。状態の正は URL なので親が組み立てる。 */
  shareTargetUrl: string;
  onToggleSave: () => void;
  onSetStatus: (next: SavedStatus) => void;
  onClose: () => void;
  /** 共有シートが使えずクリップボードに退避したときなどの通知。 */
  onNotify: (message: string) => void;
};

export default function CafeDetail({
  cafe,
  distance,
  savedStatus,
  shareTargetUrl,
  onToggleSave,
  onSetStatus,
  onClose,
  onNotify,
}: Props) {
  const isSaved = savedStatus !== undefined;
  const openStatus = getOpenStatusLabel(cafe);
  const mapUrl = getCafeMapUrl(cafe);
  const website = parseCafeWebsite(cafe);
  const domain = getCafeDomain(cafe);
  const photoUrl = getCafePhotoUrl(cafe);
  const categoryLabel = getCategoryLabel(cafe.category);
  const todayHours = getTodayHours(cafe.weekdayDescriptions);

  // 共有は lib/share.ts を通す（iOS ではネイティブの共有シートに差し替わる）。
  const handleShare = async () => {
    const result = await shareUrl({ title: cafe.name, url: shareTargetUrl });

    if (result === 'copied') {
      onNotify('URLをコピーしました');
    } else if (result === 'failed') {
      onNotify('共有できませんでした');
    }
  };

  // パネルが現れたらフォーカスを移す。移さないとキーボード / 読み上げの利用者は
  // 「カードを押したのに何も起きていない」ように感じる。閉じたときの復帰は
  // 呼び出し側（useMapSelection の dismiss）が元のカードへ戻す。
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [cafe.id]);

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label={`${cafe.name} の詳細`}
      className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {photoUrl && (
        <div className="relative h-32 w-full bg-surface-sunken">
          <Image src={photoUrl} alt="" width={400} height={160} unoptimized className="h-full w-full object-cover" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="flex-1 min-w-0 text-lg font-bold leading-[1.4] text-text">{cafe.name}</h2>
              <OpenStatusBadge openNow={cafe.openNow} plain />
            </div>

            {(categoryLabel || distance != null) && (
              <p className="mt-1 text-sm leading-[1.6] text-text-muted">
                {categoryLabel}
                {categoryLabel && distance != null && <span aria-hidden>　・　</span>}
                {distance != null && (
                  <>
                    <span className="num">現在地から{formatDistance(distance)}</span>
                    <span aria-hidden>　・　</span>
                    <span className="num">徒歩{formatWalkingMinutes(distance)}</span>
                  </>
                )}
              </p>
            )}

            {/* 営業中なら「21:00まで」、閉店中なら「8:00から」。 */}
            {openStatus && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm leading-[1.6] text-text-muted">
                <ClockIcon className="w-4 h-4" />
                <span>
                  <span className="num">{openStatus.value}</span>
                  {openStatus.suffix}
                </span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="選択を解除"
            className="h-11 w-11 -mr-2 -mt-2 shrink-0 flex items-center justify-center rounded-full text-text-muted"
          >
            <CloseIcon />
          </button>
        </div>

        {cafe.rating != null && (
          <div className="mt-3 flex items-center gap-2">
            <span className="num text-2xl font-bold leading-none text-text">{cafe.rating.toFixed(1)}</span>
            <RatingStars rating={cafe.rating} />
            {cafe.userRatingCount != null && (
              <span className="text-xs text-text-muted">
                <span className="num">{cafe.userRatingCount}</span>件のクチコミ
              </span>
            )}
          </div>
        )}

        {/* アクション行（アイコン + ラベルの縦積みはここだけ / docs/design.md 5節） */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl bg-primary text-white text-xs font-bold"
          >
            <LocationIcon className="w-5 h-5" />
            地図でみる
          </a>

          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={isSaved}
            className={`min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold ${isSaved ? 'border-accent bg-accent-soft text-accent-text' : 'border-border bg-surface text-text'}`}
          >
            <BookmarkIcon filled={isSaved} className="w-5 h-5" />
            {isSaved ? '保存済み' : '保存'}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface text-xs font-bold text-text"
          >
            <ShareIcon className="w-5 h-5" />
            シェア
          </button>
        </div>

        {/*
          「行きたい / 訪問済み」。保存していないカフェに状態は無いので、保存後だけ出す。
          押せるのに効かない UI を作らないため（docs/design.md 1節）。
        */}
        {isSaved && (
          <div className="mt-3 flex gap-2" role="group" aria-label="保存した状態">
            {(
              [
                { id: 'want', label: '行きたい' },
                { id: 'visited', label: '訪問済み' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSetStatus(id)}
                aria-pressed={savedStatus === id}
                className={`flex-1 min-h-11 rounded-xl border text-xs font-bold ${savedStatus === id
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 情報行（.pen の Info）。値が取れないフィールドは行ごと出さない。 */}
        <div className="mt-4 divide-y divide-border border-t border-border">
          <InfoRow icon={<LocationIcon className="w-[17px] h-[17px]" />} label="住所" href={mapUrl}>
            {cafe.address}
          </InfoRow>

          {todayHours && (
            <InfoRow icon={<ClockIcon />} label="営業時間">
              {todayHours}
            </InfoRow>
          )}

          {cafe.phone && (
            <InfoRow icon={<PhoneIcon />} label="電話" href={`tel:${cafe.phone.replace(/[^0-9+]/g, '')}`}>
              <span className="num">{cafe.phone}</span>
            </InfoRow>
          )}

          {domain && website && (
            <InfoRow icon={<LinkIcon className="w-[17px] h-[17px]" />} label="ウェブサイト" href={website.href}>
              <span className="truncate block">{domain}</span>
            </InfoRow>
          )}
        </div>
      </div>
    </section>
  );
}

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.round(rating);

  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={`w-4 h-4 ${i <= filled ? 'text-star' : 'text-border'}`} />
      ))}
    </span>
  );
}

/** 詳細の情報行（.pen の Info Row）。href があればリンク、無ければただの行。 */
function InfoRow({
  icon,
  label,
  href,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] leading-none text-text-muted">{label}</span>
        <span className="block text-[13px] leading-[1.5] text-text mt-1">{children}</span>
      </span>
      {href && <ChevronRightIcon className="w-4 h-4 shrink-0 self-center text-text-muted" />}
    </>
  );

  const className = 'flex items-center gap-3 py-2.5 min-h-11';

  if (!href) {
    return <div className={className}>{body}</div>;
  }

  // tel: は同一タブで開く（新規タブを作っても発信画面に行かない端末がある）
  const external = href.startsWith('http');

  return (
    <a href={href} className={className} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {body}
    </a>
  );
}
