'use client';

import type { Cafe, Coordinates } from '@/lib/api';
import { getDistanceMeters } from '@/lib/geo';
import type { useCafeFilters } from '@/hooks/useCafeFilters';
import type { SavedStatus } from '@/lib/storage';

import CafeDetail from './CafeDetail';
import CafeList from './CafeList';
import { emptyStateCopy } from './EmptyState';
import ListHeader from './ListHeader';
import { tabButtonId, tabPanelId } from './ViewSwitch';
import type { TabId } from './ViewSwitch';
import Welcome from './Welcome';

type Filters = ReturnType<typeof useCafeFilters>;

type Props = {
  tab: TabId;
  filters: Filters;
  /** 一覧の見出し（エリア名 / この辺り）。 */
  searchTitle: string;
  hasSearched: boolean;
  isLoading: boolean;
  /** 絞り込む前の検索結果が 1 件以上あるか。チップを出すかどうかに使う。 */
  hasResults: boolean;
  /** 検索が失敗したときのメッセージ。 */
  errorMessage: string | null;
  /** 検索が完了するたびに増える値。一覧の出現をやり直す合図。 */
  searchToken: number;
  currentLocation: Coordinates | null;
  selectedCafe: Cafe | null;
  shareTargetUrl: string | null;
  recentAreas: readonly string[];
  isLocating: boolean;
  getSavedStatus: (cafeId: string) => SavedStatus | undefined;
  onLocate: () => void;
  onSearchArea: (area: string) => void;
  onRetry: () => void;
  onGoSearch: () => void;
  onSelect: (id: string) => void;
  onToggleSave: (cafe: Cafe) => void;
  onSetStatus: (cafeId: string, status: SavedStatus) => void;
  onCloseDetail: () => void;
  onNotify: (message: string) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * 本体の中身。初回表示 / 一覧 / 詳細のどれか 1 つを出す（docs/design.md 4.5節）。
 *
 * 詳細は一覧の上に重ねて出し、一覧は裏に置いたままにする。戻ったときに
 * スクロール位置とフォーカスをそのまま返せるようにするため。
 */
export default function Panel({
  tab,
  filters,
  searchTitle,
  hasSearched,
  isLoading,
  hasResults,
  errorMessage,
  searchToken,
  currentLocation,
  selectedCafe,
  shareTargetUrl,
  recentAreas,
  isLocating,
  getSavedStatus,
  onLocate,
  onSearchArea,
  onRetry,
  onGoSearch,
  onSelect,
  onToggleSave,
  onSetStatus,
  onCloseDetail,
  onNotify,
  listRef,
}: Props) {
  const showWelcome = tab === 'search' && !hasSearched;
  const detailOpen = selectedCafe !== null && shareTargetUrl !== null;
  const searchLoading = isLoading && tab === 'search';

  // 読み上げ用の状況。未検索・失敗のときは何も言わない（失敗はトーストと空状態が伝える）。
  const statusText = showWelcome || errorMessage
    ? ''
    : searchLoading
      ? '検索中'
      : `${filters.cafes.length}件${tab === 'saved' ? '保存しています' : '見つかりました'}`;

  return (
    <div
      id={tabPanelId}
      role="tabpanel"
      aria-labelledby={tabButtonId(tab)}
      className="relative flex min-h-0 flex-1 flex-col"
    >
      {/*
        件数の読み上げ。常に DOM に置く（あとから差し込んだ live region は読まれないことがある）。
        スケルトンは aria-hidden なので、読み上げ環境にはここだけが「検索中」「N 件見つかりました」として届く。
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {statusText}
      </p>

      {/* 詳細が開いている間、裏の一覧は操作も読み上げもさせない。 */}
      <div inert={detailOpen} className="flex min-h-0 flex-1 flex-col">
        {showWelcome ? (
          <Welcome recentAreas={recentAreas} isLocating={isLocating} onLocate={onLocate} onSearch={onSearchArea} />
        ) : (
          <CafeList
            header={
              <ListHeader
                tab={tab}
                title={tab === 'saved' ? '保存したカフェ' : searchTitle}
                // 保存の一覧は、すぐ下のチップが件数を出す。同じ数を 2 回言わない。
                count={searchLoading || tab === 'saved' ? null : filters.cafes.length}
                showFilters={hasResults && !isLoading}
                openNowOnly={filters.openNowOnly}
                onToggleOpenNow={filters.toggleOpenNow}
                priceFilters={filters.priceFilters}
                onTogglePrice={filters.togglePrice}
                savedFilter={filters.savedFilter}
                onSavedFilterChange={filters.setSavedFilter}
                savedCounts={filters.savedCounts}
                showSort={filters.canSortByDistance && filters.cafes.length > 1 && !searchLoading}
                sortByDistance={filters.sortByDistance}
                onToggleSort={filters.toggleSort}
              />
            }
            cafes={filters.cafes}
            isLoading={searchLoading}
            currentLocation={currentLocation}
            getSavedStatus={getSavedStatus}
            showSavedBadge={tab === 'search' || filters.savedFilter === 'all'}
            onSelect={onSelect}
            listKey={`${tab}:${searchToken}`}
            empty={emptyStateCopy({
              tab,
              savedFilter: filters.savedFilter,
              activeFilterCount: filters.activeFilterCount,
              errorMessage,
              onClearFilters: filters.clearFilters,
              onRetry,
              onShowAllSaved: () => filters.setSavedFilter('all'),
              onGoSearch,
            })}
            listRef={listRef}
          />
        )}
      </div>

      {detailOpen && (
        <CafeDetail
          key={selectedCafe.id}
          cafe={selectedCafe}
          distance={getDistanceMeters(currentLocation, selectedCafe)}
          savedStatus={getSavedStatus(selectedCafe.id)}
          shareTargetUrl={shareTargetUrl}
          onToggleSave={() => onToggleSave(selectedCafe)}
          onSetStatus={(next) => onSetStatus(selectedCafe.id, next)}
          onClose={onCloseDetail}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
