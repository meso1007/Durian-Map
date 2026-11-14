'use client';

import { POPULAR_AREAS } from './SearchBar';
import { ChevronRightIcon, HistoryIcon, LoadingSpinner, TargetIcon } from './icons';

/**
 * 初回表示（まだ何も検索していないとき）。
 *
 * 何のアプリか・最初に何を押せばよいかを、この 1 面で伝える。
 * 最重要 CTA（マンゴー）はここに 1 つだけ置く。検索したあとは検索バーの現在地ボタンが引き継ぐ。
 * エリアのチップは押せば実際にそのエリアを検索する（飾りのタグは置かない / docs/design.md 1節）。
 */
export default function Welcome({
  recentAreas,
  isLocating,
  onLocate,
  onSearch,
}: {
  recentAreas: readonly string[];
  isLocating: boolean;
  onLocate: () => void;
  onSearch: (area: string) => void;
}) {
  const popular = POPULAR_AREAS.filter((name) => !recentAreas.includes(name));

  return (
    <div className="dm-scroll flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-1 md:px-6 md:pt-3">
      <p className="animate-rise font-display text-xs font-bold uppercase tracking-[0.18em] text-success-text">
        Independent cafes only
      </p>

      <h2 className="mt-2 animate-rise text-[28px] font-bold leading-[1.3] tracking-[-0.01em] text-text [animation-delay:40ms] md:text-[32px]">
        チェーンじゃない、
        <br />
        あの一杯へ。
      </h2>

      <p className="mt-3 animate-rise text-[15px] leading-[1.7] text-text-muted [animation-delay:80ms]">
        大手チェーンを除いて、個人経営の小さなカフェだけを地図に出します。
      </p>

      <button
        type="button"
        onClick={onLocate}
        disabled={isLocating}
        className="mt-5 flex min-h-14 w-full animate-rise items-center gap-3 rounded-2xl bg-cta px-4 text-left text-text transition-transform duration-[var(--dm-duration-fast)] [animation-delay:120ms] active:scale-[0.98] disabled:opacity-60"
      >
        <span className="shrink-0">{isLocating ? <LoadingSpinner /> : <TargetIcon />}</span>
        <span className="min-w-0 flex-1 text-base font-bold">{isLocating ? '現在地を取得中…' : '近くからさがす'}</span>
        <ChevronRightIcon className="h-5 w-5 shrink-0" />
      </button>

      <div className="mt-7 animate-rise [animation-delay:160ms]">
        {recentAreas.length > 0 && (
          <AreaGroup title="最近の検索" areas={recentAreas} onSearch={onSearch} recent />
        )}
        <AreaGroup title="エリアからさがす" areas={popular} onSearch={onSearch} />
      </div>
    </div>
  );
}

function AreaGroup({
  title,
  areas,
  recent = false,
  onSearch,
}: {
  title: string;
  areas: readonly string[];
  recent?: boolean;
  onSearch: (area: string) => void;
}) {
  if (areas.length === 0) return null;

  return (
    <section className="mb-5 last:mb-0">
      <h3 className="text-xs font-bold text-text-muted">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {areas.map((name) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => onSearch(name)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-medium text-text transition-colors duration-[var(--dm-duration-fast)] hover:border-primary hover:bg-surface-sunken"
            >
              {recent && <HistoryIcon className="h-3.5 w-3.5 text-text-muted" />}
              {name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
