'use client';

import type { SavedFilter } from '@/hooks/useCafeFilters';
import { PRICE_FILTERS } from '@/lib/cafe';
import type { PriceFilterId } from '@/lib/cafe';

import { SortIcon } from './icons';
import type { TabId } from './ViewSwitch';

type Props = {
  tab: TabId;
  /** 見出し。検索ならエリア名、現在地検索なら「この辺り」。 */
  title: string;
  /** 絞り込み後の件数。読み込み中は null（件数を出さない）。 */
  count: number | null;
  /** 絞り込みチップを出すか（絞る対象があるときだけ）。 */
  showFilters: boolean;
  openNowOnly: boolean;
  onToggleOpenNow: () => void;
  priceFilters: readonly PriceFilterId[];
  onTogglePrice: (id: PriceFilterId) => void;
  savedFilter: SavedFilter;
  onSavedFilterChange: (next: SavedFilter) => void;
  savedCounts: { all: number; want: number; visited: number };
  /** 並び替えは現在地が取れていて 2 件以上あるときだけ出す。 */
  /** 見出しの右に置く操作（保存の一覧なら「友達に送る」）。押せば実際に何かが起きるものだけ。 */
  action?: { label: string; onClick: () => void };
  showSort: boolean;
  sortByDistance: boolean;
  onToggleSort: () => void;
};

/**
 * 一覧の見出しと絞り込み。
 *
 * チップは押した分だけ実際に効かせる（見た目だけのフィルタは作らない / docs/design.md 1節）。
 * 折り返すと一覧の高さを食うので、横スクロールの 1 行にする。
 */
export default function ListHeader({
  tab,
  title,
  count,
  showFilters,
  openNowOnly,
  onToggleOpenNow,
  priceFilters,
  onTogglePrice,
  savedFilter,
  onSavedFilterChange,
  savedCounts,
  showSort,
  sortByDistance,
  onToggleSort,
  action,
}: Props) {
  return (
    <div className="shrink-0 pb-2">
      <div className="flex min-h-11 items-center gap-3 px-5 md:px-6">
        <h2 className="min-w-0 flex-1 truncate text-xl font-bold leading-[1.4] text-text">
          {title}
          {count !== null && (
            <span className="ml-2 text-sm font-medium text-text-muted">
              <span className="num text-base font-bold text-text">{count}</span>件
            </span>
          )}
        </h2>

        {showSort && (
          <Chip active={sortByDistance} onClick={onToggleSort}>
            <SortIcon />
            近い順
          </Chip>
        )}

        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-primary px-3 text-sm font-medium text-white transition-colors duration-[var(--dm-duration-fast)] hover:bg-primary-deep"
          >
            {action.label}
          </button>
        )}
      </div>

      {tab === 'search' && showFilters && (
        <div role="group" aria-label="絞り込み" className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-1 md:px-6">
          <Chip active={openNowOnly} onClick={onToggleOpenNow}>
            <span className={`h-1.5 w-1.5 rounded-full ${openNowOnly ? 'bg-lime' : 'bg-success'}`} />
            営業中
          </Chip>

          {PRICE_FILTERS.map(({ id, label }) => (
            <Chip key={id} active={priceFilters.includes(id)} onClick={() => onTogglePrice(id)}>
              <span className="num">{label}</span>
            </Chip>
          ))}
        </div>
      )}

      {tab === 'saved' && savedCounts.all > 0 && (
        <div role="group" aria-label="保存した状態で絞り込む" className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-1 md:px-6">
          {(
            [
              { id: 'all', label: 'すべて', count: savedCounts.all },
              { id: 'want', label: '行きたい', count: savedCounts.want },
              { id: 'visited', label: '訪問済み', count: savedCounts.visited },
            ] as const
          ).map(({ id, label, count: segmentCount }) => (
            <Chip key={id} active={savedFilter === id} onClick={() => onSavedFilterChange(id)}>
              {label}
              <span className="num opacity-80">{segmentCount}</span>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** 押せるチップ。見た目の高さは 36px、タップ領域は上下に広げて 44px を確保する。 */
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
      className={`relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 text-sm font-medium transition-colors duration-[var(--dm-duration-fast)] before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] ${active
        ? 'border-primary-deepest bg-primary-deepest text-cream'
        : 'border-border bg-surface text-text hover:border-primary'}`}
    >
      {children}
    </button>
  );
}
