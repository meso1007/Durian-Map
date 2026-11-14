'use client';

import { useEffect, useRef } from 'react';

import { getCafePhotoUrl } from '@/lib/api';
import type { Cafe } from '@/lib/api';
import {
  formatAddress,
  getCafeDirectionsUrl,
  getCafeDomain,
  getCafeMapUrl,
  getCategoryLabel,
  getMinutesUntilClose,
  getOpenStatusLabel,
  getPriceLabel,
  getWeekHours,
  parseCafeWebsite,
} from '@/lib/cafe';
import { formatDistance, formatWalkingMinutes } from '@/lib/geo';
import { shareUrl } from '@/lib/share';
import type { SavedStatus } from '@/lib/storage';
import { useNow } from '@/hooks/useNow';
import { CAFE_PHOTO_TRANSITION } from '@/lib/viewTransition';

import BrandMark from './BrandMark';
import Photo from './Photo';
import WeekHours from './WeekHours';
import {
  ArrowLeftIcon,
  BookmarkIcon,
  ChevronRightIcon,
  DirectionsIcon,
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

const SAVED_STATUSES = [
  { id: 'want', label: '行きたい' },
  { id: 'visited', label: '訪問済み' },
] as const;

/**
 * カフェの詳細。一覧と同じ場所に入れ替わりで出る（docs/design.md 4.5節）。
 *
 * 出すのは Places から実際に取れた値だけ。取れない項目は行ごと出さない。
 */
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
  const website = parseCafeWebsite(cafe);
  const domain = getCafeDomain(cafe);
  const photoUrl = getCafePhotoUrl(cafe, 800);
  const weekHours = getWeekHours(cafe.weekdayDescriptions);
  const now = useNow();

  // 閉店まで 1 時間を切っていたら、時刻ではなく残り時間で伝える（いま向かって間に合うかが分かる）。
  const minutesLeft = cafe.openNow ? getMinutesUntilClose(cafe.closesAt, new Date(now)) : null;
  const closingSoon = minutesLeft !== null && minutesLeft <= 60 ? minutesLeft : null;
  const categoryLabel = getCategoryLabel(cafe.category);
  const priceLabel = getPriceLabel(cafe);

  // 共有は lib/share.ts を通す（iOS ではネイティブの共有シートに差し替わる）。
  const handleShare = async () => {
    const result = await shareUrl({ title: cafe.name, url: shareTargetUrl });

    if (result === 'copied') {
      onNotify('リンクをコピーしました');
    } else if (result === 'failed') {
      onNotify('共有できませんでした');
    }
  };

  // 詳細が現れたら見出しへフォーカスを移す。移さないとキーボード / 読み上げの利用者は
  // 「カードを押したのに何も起きていない」ように感じる。閉じたときの復帰は
  // 呼び出し側（useMapSelection の dismiss）が元のカードへ戻す。
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [cafe.id]);

  return (
    <article
      ref={scrollRef}
      aria-labelledby="cafe-detail-title"
      className="dm-scroll absolute inset-0 z-10 overflow-y-auto bg-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-1 md:pt-4"
    >
      {/*
        写真。無い店は面の色とマークで埋める（壊れた画像や空白にしない）。
        モバイルでは低めに抑える: シートが半分の段でも店名と評価まで見えるようにするため。
      */}
      <div style={{ viewTransitionName: CAFE_PHOTO_TRANSITION }}
        className="relative mx-3 flex h-32 items-center justify-center overflow-hidden rounded-[20px] bg-surface-sunken md:mx-4 md:h-56">
        {/* マークは写真の下に敷いておく。読み込み中も「空の箱」に見えず、写真が無い店ではそのまま残る。 */}
        <BrandMark className="absolute h-14 w-14 opacity-30" />
        <Photo src={photoUrl} alt={`${cafe.name} の写真`} eager className="relative" fallback={null} />

        <button
          type="button"
          onClick={onClose}
          aria-label="一覧に戻る"
          className="absolute left-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-text shadow-card transition-transform duration-[var(--dm-duration-fast)] active:scale-95"
        >
          <ArrowLeftIcon />
        </button>
      </div>

      {/* 本文は写真より少し遅れて、同じ速さで入る（写真の遷移と別々の動きに見えないように）。 */}
      <div className="animate-rise px-5 pt-4 [animation-delay:80ms] md:px-6">
        <h2
          id="cafe-detail-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-[22px] font-bold leading-[1.35] text-text focus-visible:outline-none"
        >
          {cafe.name}
        </h2>

        {/*
          判断に要る値を 1 行で。箱で囲まず、数値（Co Headline）の大きさで主従を付ける。
          いずれも値が取れたときだけ出す。
        */}
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {cafe.rating != null && (
            <span className="inline-flex items-baseline gap-1">
              <StarIcon className="h-4 w-4 translate-y-0.5 self-center text-star" />
              <span className="sr-only">評価</span>
              <span className="num text-xl font-bold leading-none text-text">{cafe.rating.toFixed(1)}</span>
              {cafe.userRatingCount != null && (
                <span className="num text-sm text-text-muted">
                  ({cafe.userRatingCount}
                  <span className="sr-only">件のクチコミ</span>)
                </span>
              )}
            </span>
          )}

          {cafe.openNow !== undefined && (
            <span className={`inline-flex items-center gap-1.5 text-[15px] font-bold ${cafe.openNow && closingSoon === null ? 'text-success-text' : 'text-accent-text'}`}>
              <span className={`h-2 w-2 rounded-full ${cafe.openNow && closingSoon === null ? 'bg-success' : 'bg-accent'}`} />
              {closingSoon !== null ? (
                <span>
                  あと<span className="num">{closingSoon}</span>分で閉店
                </span>
              ) : (
                <>
                  {cafe.openNow ? '営業中' : '営業時間外'}
                  {openStatus && (
                    <span className="font-medium text-text-muted">
                      <span className="num">{openStatus.value}</span>
                      {openStatus.suffix}
                    </span>
                  )}
                </>
              )}
            </span>
          )}
        </p>

        {(categoryLabel || priceLabel || distance != null) && (
          <p className="mt-1.5 flex flex-wrap gap-x-2 text-sm text-text-muted">
            {categoryLabel && <span>{categoryLabel}</span>}
            {priceLabel && <span className="num">{priceLabel}</span>}
            {distance != null && (
              <span>
                <span className="num">{formatDistance(distance)}</span>
                <span className="ml-1">
                  徒歩<span className="num">{formatWalkingMinutes(distance)}</span>
                </span>
              </span>
            )}
          </p>
        )}

        {/* アクション。主役は経路（Primary）。保存と共有は Secondary。 */}
        <div className="mt-4 flex gap-2">
          <a
            href={getCafeDirectionsUrl(cafe)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white transition-colors duration-[var(--dm-duration-fast)] hover:bg-primary-deep"
          >
            <DirectionsIcon />
            ここへ行く
          </a>

          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={isSaved}
            className={`flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-bold transition-colors duration-[var(--dm-duration-fast)] ${isSaved ? 'border-accent bg-accent-soft text-accent-text' : 'border-border bg-surface text-text hover:border-primary'}`}
          >
            <BookmarkIcon key={String(isSaved)} filled={isSaved} className={`h-5 w-5 ${isSaved ? 'animate-bump' : ''}`} />
            {isSaved ? '保存済み' : '保存'}
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label="共有"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text transition-colors duration-[var(--dm-duration-fast)] hover:border-primary"
          >
            <ShareIcon className="h-5 w-5" />
          </button>
        </div>

        {/*
          「行きたい / 訪問済み」。保存していないカフェに状態は無いので、保存後だけ出す。
          押せるのに効かない UI を作らないため（docs/design.md 1節）。
        */}
        {isSaved && (
          <div role="group" aria-label="保存した状態" className="mt-2 grid animate-fade grid-cols-2 gap-1 rounded-xl bg-surface-sunken p-1">
            {SAVED_STATUSES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSetStatus(id)}
                aria-pressed={savedStatus === id}
                className={`h-11 rounded-lg text-[13px] font-bold transition-colors duration-[var(--dm-duration-fast)] ${savedStatus === id ? 'bg-primary-deepest text-cream' : 'text-text-muted hover:text-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {weekHours && <WeekHours rows={weekHours} />}

        {/* 情報行。値が取れないフィールドは行ごと出さない。 */}
        <div className="mt-5 divide-y divide-border border-y border-border">
          <InfoRow icon={<LocationIcon className="h-[18px] w-[18px]" />} label="住所" href={getCafeMapUrl(cafe)}>
            {formatAddress(cafe.address)}
          </InfoRow>

          {cafe.phone && (
            <InfoRow icon={<PhoneIcon className="h-[18px] w-[18px]" />} label="電話" href={`tel:${cafe.phone.replace(/[^0-9+]/g, '')}`}>
              <span className="num">{cafe.phone}</span>
            </InfoRow>
          )}

          {domain && website && (
            <InfoRow icon={<LinkIcon className="h-[18px] w-[18px]" />} label="ウェブサイト" href={website.href}>
              <span className="block truncate">{domain}</span>
            </InfoRow>
          )}
        </div>
      </div>
    </article>
  );
}

/** 詳細の情報行。アイコン + ラベル + 値 + シェブロン。行全体がリンク。 */
function InfoRow({
  icon,
  label,
  href,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  // tel: は同一タブで開く（新規タブを作っても発信画面に行かない端末がある）
  const external = href.startsWith('http');

  return (
    <a
      href={href}
      className="group flex min-h-14 items-center gap-3 py-2.5"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] leading-none text-text-muted">{label}</span>
        <span className="mt-1 block text-sm leading-[1.5] text-text">{children}</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-[var(--dm-duration-fast)] group-hover:translate-x-0.5" />
    </a>
  );
}
