'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import type { Cafe, Coordinates } from '@/lib/api';
import { getMapInsets, getSheetHeights } from '@/lib/layout';
import type { SheetSnap } from '@/lib/sheet';

import { useCafeFilters } from '@/hooks/useCafeFilters';
import { DEFAULT_NEARBY_RADIUS, useCafeSearch } from '@/hooks/useCafeSearch';
import type { SearchQuery, SearchRadius } from '@/hooks/useCafeSearch';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useMapSelection, useSelectedCafe } from '@/hooks/useMapSelection';
import { useRecentAreas } from '@/hooks/useRecentAreas';
import { useSavedCafes } from '@/hooks/useSavedCafes';
import { areaQuery, buildCafeShareUrl, useInitialSearchUrl, useRestoreSearchFromUrl, useSearchUrlState } from '@/hooks/useSearchUrlState';
import { useToast } from '@/hooks/useToast';
import { useViewport } from '@/hooks/useViewport';

import MapArea from './components/MapArea';
import Panel from './components/Panel';
import SearchBar from './components/SearchBar';
import Sheet from './components/Sheet';
import Toast from './components/Toast';
import ViewSwitch from './components/ViewSwitch';
import type { TabId } from './components/ViewSwitch';

/**
 * 画面の骨格（docs/design.md 4.5節）。
 *
 * 地図を全面に敷き、検索バーと本体（シート / パネル）をその上に浮かせる。
 * レイアウトの切り替えは CSS（md:）だけで行い、JS が知るのは「地図のどこが覆われているか」だけ。
 */
function CafeFinderContent() {
  const { toast, showError, showNotice } = useToast();
  const { state: searchState, query, search, completedCount, results, isLoading, hasSearched } = useCafeSearch(showError);

  // URL を状態の正にする。マウント時の URL が初期状態になり、以降は状態が変わるたびに
  // 書き戻す（リロードでも共有リンクでも同じ画面に戻る）。
  const initialUrl = useInitialSearchUrl();
  const [tab, setTab] = useState<TabId>(initialUrl.tab);
  const [snap, setSnap] = useState<SheetSnap>(initialUrl.cafeId ? 'full' : 'half');

  const { selectedId, listRef, select, clear, dismiss } = useMapSelection(initialUrl.cafeId);
  const urlState = { tab, query: query ?? initialUrl.query, cafeId: selectedId };

  useSearchUrlState(urlState);
  useRestoreSearchFromUrl(initialUrl, search);

  const viewport = useViewport();
  const sheetHeights = useMemo(() => getSheetHeights(viewport), [viewport]);
  const insets = useMemo(() => getMapInsets(viewport, snap), [viewport, snap]);

  const { recentAreas, rememberArea } = useRecentAreas();

  /** ユーザーが自分で始めた検索。前の選択を解き、シートを半分に戻して地図と一覧を並べる。 */
  const startSearch = useCallback(
    (next: SearchQuery) => {
      clear();
      setTab('search');
      setSnap('half');
      if (next.kind === 'area') rememberArea(next.area);
      void search(next);
    },
    [clear, rememberArea, search],
  );

  const { coordinates: currentLocation, resolvedAreaName, isLocating, locate } = useCurrentLocation({
    onError: showError,
    onLocated: useCallback(
      (position: Coordinates) => startSearch({ kind: 'nearby', coordinates: position, radius: DEFAULT_NEARBY_RADIUS }),
      [startSearch],
    ),
  });

  const { savedCafes, toggleSave, setStatus, getStatus } = useSavedCafes({
    onError: showError,
    onNotice: showNotice,
  });
  const savedIds = useMemo(() => new Set(savedCafes.map((cafe) => cafe.id)), [savedCafes]);

  const filters = useCafeFilters({ tab, results, savedCafes, currentLocation });
  const selectedCafe = useSelectedCafe(selectedId, filters.cafes);

  // 共有 URL。検索条件がまだ無ければ、逆ジオで引いた地名で代用する。
  const shareTargetUrl = selectedCafe
    ? buildCafeShareUrl(
        urlState.query ? urlState : { ...urlState, query: areaQuery(resolvedAreaName) },
        selectedCafe,
      )
    : null;

  const searchArea = query?.kind === 'area' ? query.area : initialUrl.query?.kind === 'area' ? initialUrl.query.area : '';
  const searchTitle = query?.kind === 'nearby' ? 'この辺りのカフェ' : searchArea ? `${searchArea}のカフェ` : 'カフェ';

  const handleSelectFromList = useCallback(
    (id: string) => {
      select(id, 'list');
      setSnap('full');
    },
    [select],
  );

  // 地図のピンから選んだときは半分まで。選んだ店が地図に見えたままになる。
  const handleSelectFromMap = useCallback(
    (id: string) => {
      select(id, 'map');
      setSnap('half');
    },
    [select],
  );

  const handleTabChange = useCallback(
    (next: TabId) => {
      // タブを跨いで選択を持ち越すと、詳細だけ前のタブのものが残る。
      setTab(next);
      clear();
      setSnap((current) => (current === 'peek' ? 'half' : current));
    },
    [clear],
  );

  // Esc で詳細を閉じる（入力候補が開いているときは SearchBar 側が先に受けて止める）。
  useEffect(() => {
    if (!selectedId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, dismiss]);

  return (
    <div className="relative isolate h-dvh w-full overflow-hidden bg-map-land text-text">
      <MapArea
        cafes={filters.cafes}
        selectedId={selectedId}
        savedIds={savedIds}
        currentLocation={currentLocation}
        insets={insets}
        searchToken={completedCount}
        onSelectCafe={handleSelectFromMap}
        onClearSelection={clear}
        onSearchThisArea={(coordinates: Coordinates, radius: SearchRadius) =>
          startSearch({ kind: 'nearby', coordinates, radius })
        }
        onError={showError}
      />

      {/*
        地図の上に浮く UI。モバイルでは検索バー（上）とシート（下）が別々に浮き、
        PC では左の列に縦に並ぶ。列そのものは地図の操作を邪魔しない（pointer-events-none）。
      */}
      <div className="pointer-events-none absolute inset-0 z-10 md:right-auto md:flex md:w-[416px] md:flex-col md:gap-3 md:p-4 lg:w-[448px]">
        <SearchBar
          area={searchArea}
          recentAreas={recentAreas}
          isLocating={isLocating}
          isSearching={isLoading}
          showLocate={hasSearched || tab === 'saved'}
          onLocate={locate}
          onSearch={(area) => startSearch({ kind: 'area', area })}
        />

        <Sheet
          snap={snap}
          heights={sheetHeights}
          draggable={!viewport.isDesktop}
          onSnapChange={setSnap}
          header={<ViewSwitch active={tab} onChange={handleTabChange} savedCount={savedCafes.length} />}
        >
          <Panel
            tab={tab}
            filters={filters}
            searchTitle={searchTitle}
            hasSearched={hasSearched}
            isLoading={isLoading}
            hasResults={results.length > 0}
            errorMessage={searchState.status === 'error' ? searchState.message : null}
            searchToken={completedCount}
            currentLocation={currentLocation}
            selectedCafe={selectedCafe}
            shareTargetUrl={shareTargetUrl}
            recentAreas={recentAreas}
            isLocating={isLocating}
            getSavedStatus={getStatus}
            onLocate={locate}
            onSearchArea={(area) => startSearch({ kind: 'area', area })}
            onRetry={() => {
              if (query) void search(query);
            }}
            onGoSearch={() => handleTabChange('search')}
            onSelect={handleSelectFromList}
            onToggleSave={(cafe: Cafe) => void toggleSave(cafe)}
            onSetStatus={(cafeId, status) => void setStatus(cafeId, status)}
            onCloseDetail={dismiss}
            onNotify={showNotice}
            listRef={listRef}
          />
        </Sheet>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

// 静的書き出しの HTML に入る最初の絵。地図の色で埋め、すぐに本体へ差し替わる。
const LOADING = <div className="h-dvh w-full bg-map-land" aria-hidden />;

// useSearchParams は Suspense の内側でしか使えない（静的書き出しでも同じ）。
export default function CafeFinder() {
  return <Suspense fallback={LOADING}><CafeFinderContent /></Suspense>;
}
