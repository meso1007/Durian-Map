'use client';

import type { SavedFilter } from '@/hooks/useCafeFilters';

import SavedSegments from './SavedSegments';
import { SortIcon } from './icons';
import type { TabId } from './TabBar';

/** シート見出し（.pen の Sheet Head）。中身が無いうちは出さない。 */
export default function SheetHeader({
  tab,
  hidden,
  savedFilter,
  onSavedFilterChange,
  savedCounts,
  showSort,
  sortByDistance,
  onToggleSort,
}: {
  tab: TabId;
  hidden: boolean;
  savedFilter: SavedFilter;
  onSavedFilterChange: (next: SavedFilter) => void;
  savedCounts: { all: number; want: number; visited: number };
  showSort: boolean;
  sortByDistance: boolean;
  onToggleSort: () => void;
}) {
  return (
    <div className={`shrink-0 flex items-center justify-between gap-2 py-2 md:pt-4 ${hidden ? 'hidden' : ''}`}>
      {tab === 'saved' ? (
        <SavedSegments value={savedFilter} onChange={onSavedFilterChange} counts={savedCounts} />
      ) : (
        <h2 className="text-[17px] font-bold leading-[1.4] text-text truncate">この辺りのカフェ</h2>
      )}

      {/* 並び替えは実際に効くときだけ出す（docs/design.md 1節） */}
      {showSort && (
        <button
          type="button"
          onClick={onToggleSort}
          aria-pressed={sortByDistance}
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${sortByDistance ? 'bg-primary text-white' : 'bg-surface-sunken text-text-muted'}`}
        >
          <SortIcon />
          近い順
        </button>
      )}
    </div>
  );
}
