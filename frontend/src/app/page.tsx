'use client';

import { Suspense, useCallback, useState } from 'react';

import type { Coordinates } from '@/lib/api';

import { useCafeFilters } from '@/hooks/useCafeFilters';
import { DEFAULT_NEARBY_RADIUS, useCafeSearch } from '@/hooks/useCafeSearch';
import type { SearchRadius } from '@/hooks/useCafeSearch';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useMapSelection, useSelectedCafe } from '@/hooks/useMapSelection';
import { useSavedCafes } from '@/hooks/useSavedCafes';
import { areaQuery, buildCafeShareUrl, useInitialSearchUrl, useRestoreSearchFromUrl, useSearchUrlState } from '@/hooks/useSearchUrlState';
import { useToast } from '@/hooks/useToast';

import AppHeader from './components/AppHeader';
import BottomSheet from './components/BottomSheet';
import type { SheetState } from './components/BottomSheet';
import CafeSheet from './components/CafeSheet';
import MapArea from './components/MapArea';
import SearchPanel from './components/SearchPanel';
import TabBar from './components/TabBar';
import type { TabId } from './components/TabBar';
import Toast from './components/Toast';

function CafeFinderContent() {
  const { toast, showError, showNotice } = useToast();
  const { query, search, completedCount, results, isLoading, hasSearched } = useCafeSearch(showError);

  // URL を状態の正にする。マウント時の URL が初期状態になり、以降は状態が変わるたびに
  // 書き戻す（リロードでも共有リンクでも同じ画面に戻る）。
  const initialUrl = useInitialSearchUrl();
  const [tab, setTab] = useState<TabId>(initialUrl.tab);
  const [sheetState, setSheetState] = useState<SheetState>('half');

  const { selectedId, selectionSource, listRef, select, clear, dismiss } = useMapSelection(initialUrl.cafeId);
  const urlState = { tab, query: query ?? initialUrl.query, cafeId: selectedId };

  useSearchUrlState(urlState);
  useRestoreSearchFromUrl(initialUrl, search);

  const { coordinates: currentLocation, resolvedAreaName, isLocating, locate } = useCurrentLocation({
    onError: showError,
    onLocated: useCallback(
      (position: Coordinates) => void search({ kind: 'nearby', coordinates: position, radius: DEFAULT_NEARBY_RADIUS }),
      [search],
    ),
  });

  const { savedCafes, toggleSave, setStatus, getStatus } = useSavedCafes({
    onError: showError,
    onNotice: showNotice,
  });

  const filters = useCafeFilters({ tab, results, savedCafes, currentLocation });
  const selectedCafe = useSelectedCafe(selectedId, filters.cafes);

  // 共有 URL。検索条件がまだ無ければ、逆ジオで引いた地名で代用する。
  const shareTargetUrl = selectedCafe
    ? buildCafeShareUrl(
        urlState.query ? urlState : { ...urlState, query: areaQuery(resolvedAreaName) },
        selectedCafe,
      )
    : null;

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-surface text-text relative isolate">
      <Toast toast={toast} />

      <AppHeader>
        <SearchPanel
          compact={tab === 'saved' || hasSearched}
          isLocating={isLocating}
          isSearching={isLoading}
          initialArea={initialUrl.query?.kind === 'area' ? initialUrl.query.area : ''}
          onLocate={locate}
          onSearch={(area) => void search({ kind: 'area', area })}
        />
      </AppHeader>

      {/* 地図 + ボトムシート。PC では 2 カラムに開く。 */}
      <div className="flex-1 w-full flex md:flex-row overflow-hidden relative">
        <MapArea
          cafes={filters.cafes}
          selectedId={selectedId}
          selectedCafe={selectedCafe}
          selectionSource={selectionSource}
          currentLocation={currentLocation}
          emphasizeCurrentLocation={query?.kind === 'nearby'}
          searchToken={completedCount}
          sheetState={sheetState}
          onSelectCafe={(id) => select(id, 'map')}
          onClearSelection={clear}
          onSearchThisArea={(coordinates: Coordinates, radius: SearchRadius) =>
            void search({ kind: 'nearby', coordinates, radius })
          }
          onError={showError}
        />

        <BottomSheet state={sheetState} onChange={setSheetState}>
          <CafeSheet
            tab={tab}
            filters={filters}
            hasSearched={hasSearched}
            isLoading={isLoading}
            hasResults={results.length > 0}
            currentLocation={currentLocation}
            selectedId={selectedId}
            selectedCafe={selectedCafe}
            selectionSource={selectionSource}
            shareTargetUrl={shareTargetUrl}
            getSavedStatus={getStatus}
            onSelect={(id) => {
              setSheetState('full');
              select(id, 'list');
            }}
            onToggleSave={(cafe) => void toggleSave(cafe)}
            onSetStatus={(cafeId, status) => void setStatus(cafeId, status)}
            onCloseDetail={dismiss}
            onNotify={showNotice}
            listRef={listRef}
          />
        </BottomSheet>
      </div>

      <TabBar
        active={tab}
        onChange={(next) => {
          // タブを跨いで選択を持ち越すと、詳細だけ前のタブのものが残る。
          setTab(next);
          clear();
        }}
        savedCount={savedCafes.length}
      />
    </div>
  );
}

const LOADING = (
  <div className="h-[100dvh] w-full bg-surface flex items-center justify-center text-sm text-text-muted">読み込み中...</div>
);

// useSearchParams は Suspense の内側でしか使えない（静的書き出しでも同じ）。
export default function CafeFinder() {
  return <Suspense fallback={LOADING}><CafeFinderContent /></Suspense>;
}
