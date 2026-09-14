'use client';

import type { Cafe, Coordinates } from '@/lib/api';
import { getDistanceMeters } from '@/lib/geo';
import type { useCafeFilters } from '@/hooks/useCafeFilters';
import type { SelectionSource } from '@/hooks/useMapSelection';
import type { SavedStatus } from '@/lib/storage';

import CafeDetail from './CafeDetail';
import CafeList from './CafeList';
import { emptyStateCopy } from './EmptyState';
import FilterChips from './FilterChips';
import SheetHeader from './SheetHeader';
import { tabButtonId, tabPanelId } from './TabBar';
import type { TabId } from './TabBar';

type Filters = ReturnType<typeof useCafeFilters>;

type Props = {
  tab: TabId;
  filters: Filters;
  hasSearched: boolean;
  isLoading: boolean;
  /** 絞り込みチップは「絞る対象がある」ときだけ出す。 */
  hasResults: boolean;
  currentLocation: Coordinates | null;
  selectedId: string | null;
  selectedCafe: Cafe | null;
  selectionSource: SelectionSource | null;
  shareTargetUrl: string | null;
  getSavedStatus: (cafeId: string) => SavedStatus | undefined;
  onSelect: (id: string) => void;
  onToggleSave: (cafe: Cafe) => void;
  onSetStatus: (cafeId: string, status: SavedStatus) => void;
  onCloseDetail: () => void;
  onNotify: (message: string) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
};

/** ボトムシートの中身。見出し・絞り込み・詳細・一覧。 */
export default function CafeSheet({
  tab,
  filters,
  hasSearched,
  isLoading,
  hasResults,
  currentLocation,
  selectedId,
  selectedCafe,
  selectionSource,
  shareTargetUrl,
  getSavedStatus,
  onSelect,
  onToggleSave,
  onSetStatus,
  onCloseDetail,
  onNotify,
  listRef,
}: Props) {
  return (
    <div
      id={tabPanelId}
      role="tabpanel"
      aria-labelledby={tabButtonId(tab)}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <SheetHeader
        tab={tab}
        hidden={tab === 'search' && !hasSearched}
        savedFilter={filters.savedFilter}
        onSavedFilterChange={filters.setSavedFilter}
        savedCounts={filters.savedCounts}
        showSort={filters.canSortByDistance && filters.cafes.length > 1}
        sortByDistance={filters.sortByDistance}
        onToggleSort={filters.toggleSort}
      />

      {tab === 'search' && hasResults && (
        <FilterChips
          openNowOnly={filters.openNowOnly}
          onToggleOpenNow={filters.toggleOpenNow}
          priceFilters={filters.priceFilters}
          onTogglePrice={filters.togglePrice}
        />
      )}

      {selectedCafe && shareTargetUrl && (
        /* 地図から選んだときはモバイルでは地図上のカードを出すので、こちらは PC だけ。 */
        <div className={`shrink-0 pb-3 ${selectionSource === 'map' ? 'hidden md:block' : 'block'}`}>
          <CafeDetail
            cafe={selectedCafe}
            distance={getDistanceMeters(currentLocation, selectedCafe)}
            savedStatus={getSavedStatus(selectedCafe.id)}
            shareTargetUrl={shareTargetUrl}
            onToggleSave={() => onToggleSave(selectedCafe)}
            onSetStatus={(next) => onSetStatus(selectedCafe.id, next)}
            onClose={onCloseDetail}
            onNotify={onNotify}
          />
        </div>
      )}

      <CafeList
        cafes={filters.cafes}
        isLoading={isLoading}
        currentLocation={currentLocation}
        selectedId={selectedId}
        getSavedStatus={getSavedStatus}
        onSelect={onSelect}
        announceResults={tab === 'saved' || hasSearched}
        empty={emptyStateCopy({
          tab,
          savedFilter: filters.savedFilter,
          hasSearched,
          activeFilterCount: filters.activeFilterCount,
        })}
        listRef={listRef}
      />
    </div>
  );
}
