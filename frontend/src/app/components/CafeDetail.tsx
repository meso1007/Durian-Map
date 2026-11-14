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
  getOpenStatusLabel,
  getPriceLabel,
  getWeekHours,
  parseCafeWebsite,
} from '@/lib/cafe';
import type { DayHours } from '@/lib/cafe';
import { formatDistance, formatWalkingMinutes } from '@/lib/geo';
import { shareUrl } from '@/lib/share';
import type { SavedStatus } from '@/lib/storage';

import BrandMark from './BrandMark';
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
  const facts = [getCategoryLabel(cafe.category), getPriceLabel(cafe)].filter(Boolean);

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
      className="dm-scroll absolute inset-0 z-10 animate-push overflow-y-auto bg-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      {/* 写真。無い店は面の色とマークで埋める（壊れた画像や空白にしない）。 */}
      <div className="relative mx-3 flex aspect-[16/10] max-h-64 items-center justify-center overflow-hidden rounded-[20px] bg-surface-sunken md:mx-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={`${cafe.name} の写真`} decoding="async" className="h-full w-full animate-fade object-cover" />
        ) : (
          <BrandMark className="h-16 w-16 opacity-40" />
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="一覧に戻る"
          className="absolute left-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-text shadow-card transition-transform duration-[var(--dm-duration-fast)] active:scale-95"
        >
          <ArrowLeftIcon />
        </button>
      </div>

      <div className="px-5 pt-4 md:px-6">
        <h2
          id="cafe-detail-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-[22px] font-bold leading-[1.35] text-text focus-visible:outline-none"
        >
          {cafe.name}
        </h2>

        {facts.length > 0 && (
          <p className="mt-1 text-sm text-text-muted">
            {facts.map((fact, index) => (
              <span key={fact}>
                {index > 0 && <span aria-hidden> · </span>}
                <span className={index === facts.length - 1 && getPriceLabel(cafe) ? 'num' : undefined}>{fact}</span>
              </span>
            ))}
          </p>
        )}

        {/* 評価と距離。数値は Co Headline（.num）。 */}
        <dl className="mt-4 flex divide-x divide-border rounded-2xl bg-surface-sunken py-3">
          {cafe.rating != null && (
            <Stat label={cafe.userRatingCount != null ? `${cafe.userRatingCount}件のクチコミ` : 'クチコミ'}>
              <StarIcon className="h-4 w-4 text-star" />
              {cafe.rating.toFixed(1)}
            </Stat>
          )}

          {distance != null && (
            <Stat label={`徒歩${formatWalkingMinutes(distance)}`}>{formatDistance(distance)}</Stat>
          )}

          {cafe.openNow !== undefined && (
            <Stat
              label={openStatus ? `${openStatus.value}${openStatus.suffix}` : '営業状態'}
              tone={cafe.openNow ? 'open' : 'closed'}
              text
            >
              <span className={`h-2 w-2 rounded-full ${cafe.openNow ? 'bg-success' : 'bg-accent'}`} />
              {cafe.openNow ? '営業中' : '時間外'}
            </Stat>
          )}
        </dl>

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
            <BookmarkIcon filled={isSaved} className="h-5 w-5" />
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
                className={`h-10 rounded-lg text-[13px] font-bold transition-colors duration-[var(--dm-duration-fast)] ${savedStatus === id ? 'bg-surface text-text shadow-card' : 'text-text-muted hover:text-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {weekHours && <HoursTable rows={weekHours} />}

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

/** 評価・距離・営業状態を横に並べる 1 マス。数値が主、説明が従。 */
function Stat({
  label,
  tone,
  text = false,
  children,
}: {
  label: string;
  tone?: 'open' | 'closed';
  /** 日本語の値（営業中 など）。数値用の書体を当てない。 */
  text?: boolean;
  children: React.ReactNode;
}) {
  const color = tone === 'open' ? 'text-success-text' : tone === 'closed' ? 'text-accent-text' : 'text-text';

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-2">
      {/* 読み上げは「説明 → 値」の順にする（dt が先）。見た目は flex-col-reverse で値を上に置く。 */}
      <dt className="order-2 max-w-full truncate text-[11px] leading-none text-text-muted">
        {/* 時刻や件数を含むので .num を当てる（日本語は M PLUS Rounded にフォールバックする） */}
        <span className="num">{label}</span>
      </dt>
      <dd className={`order-1 flex items-center gap-1 leading-none ${color} ${text ? 'text-[15px] font-bold' : 'num text-xl font-bold'}`}>
        {children}
      </dd>
    </div>
  );
}

/** 曜日別の営業時間。今日の行を強調する。 */
function HoursTable({ rows }: { rows: DayHours[] }) {
  return (
    <section className="mt-5" aria-label="営業時間">
      <h3 className="text-xs font-bold text-text-muted">営業時間</h3>
      <table className="mt-2 w-full border-separate border-spacing-0 text-sm">
        <tbody>
          {rows.map(({ day, hours, isToday, isClosed }) => (
            <tr key={day} className={isToday ? 'font-bold text-text' : 'text-text-muted'}>
              <th
                scope="row"
                className={`w-12 rounded-l-lg py-1.5 pl-3 text-left font-[inherit] ${isToday ? 'bg-success-soft' : ''}`}
              >
                {day}
                {isToday && <span className="sr-only">（今日）</span>}
              </th>
              <td className={`rounded-r-lg py-1.5 pr-3 text-right ${isToday ? 'bg-success-soft' : ''}`}>
                <span className={isClosed ? undefined : 'num'}>{hours}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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
