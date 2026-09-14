'use client';

import { PRICE_FILTERS } from '@/lib/cafe';
import type { PriceFilterId } from '@/lib/cafe';

/**
 * 検索結果の絞り込みチップ（.pen の Filters）。押した分だけ実際に効かせる
 * （見た目だけのフィルタは作らない / docs/design.md 1節）。
 *
 * 折り返すと 2 行になってリストの高さを食うので、横スクロールの 1 行にする。
 */
export default function FilterChips({
  openNowOnly,
  onToggleOpenNow,
  priceFilters,
  onTogglePrice,
}: {
  openNowOnly: boolean;
  onToggleOpenNow: () => void;
  priceFilters: PriceFilterId[];
  onTogglePrice: (id: PriceFilterId) => void;
}) {
  return (
    <div className="shrink-0 flex gap-1.5 pb-2 overflow-x-auto -mx-4 px-4 md:-mx-5 md:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip active={openNowOnly} onClick={onToggleOpenNow}>
        <span className={`h-1.5 w-1.5 rounded-full ${openNowOnly ? 'bg-white' : 'bg-success'}`} />
        営業中
      </Chip>

      {PRICE_FILTERS.map(({ id, label }) => (
        <Chip key={id} active={priceFilters.includes(id)} onClick={() => onTogglePrice(id)}>
          {label}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${active
        ? 'border-primary bg-primary text-white'
        : 'border-border bg-surface-sunken text-text-muted'}`}
    >
      {children}
    </button>
  );
}
