'use client';

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import type { Cafe, Coordinates } from '@/lib/api';
import { getCafeMapUrl, matchesPriceFilters } from '@/lib/cafe';
import type { PriceFilterId } from '@/lib/cafe';
import { getDistanceMeters } from '@/lib/geo';
import { GeolocationError, getCurrentPosition } from '@/lib/geolocation';
import { isNativePlatform } from '@/lib/platform';
import type { SavedStatus } from '@/lib/storage';

import { DEFAULT_NEARBY_RADIUS, useCafeSearch } from '@/hooks/useCafeSearch';
import { useMapSelection } from '@/hooks/useMapSelection';
import { useSavedCafes } from '@/hooks/useSavedCafes';
import { useToast } from '@/hooks/useToast';

import AppHeader from './components/AppHeader';
import BottomSheet from './components/BottomSheet';
import type { SheetState } from './components/BottomSheet';
import CafeDetail from './components/CafeDetail';
import CafeList from './components/CafeList';
import FilterChips from './components/FilterChips';
import MapSelectionCard from './components/MapSelectionCard';
import SavedSegments from './components/SavedSegments';
import type { SavedFilter } from './components/SavedSegments';
import SearchPanel from './components/SearchPanel';
import TabBar from './components/TabBar';
import type { TabId } from './components/TabBar';
import Toast from './components/Toast';
import { SortIcon } from './components/icons';

const MapView = dynamic(() => import('./components/MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-sunken" aria-hidden />,
});

// 座標からエリア名を取得（OpenStreetMap Nominatim）
const getAreaFromCoords = async (lat: number, lon: number): Promise<string> => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ja`,
    { headers: { 'User-Agent': 'DurianMap/1.0' } },
  );
  const data = await res.json();
  const addr = data.address;
  return addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
};

const getCafeShareUrl = (cafe: Cafe, area: string) => {
  // ネイティブアプリの origin は capacitor://localhost で、共有先では開けない。
  // iOS では NEXT_PUBLIC_WEB_BASE_URL（Pages の公開 URL）を使う。
  const webBaseUrl = isNativePlatform()
    ? process.env.NEXT_PUBLIC_WEB_BASE_URL?.replace(/\/$/, '')
    : typeof window === 'undefined'
      ? null
      : window.location.origin;

  if (!webBaseUrl || !area.trim()) {
    return getCafeMapUrl(cafe);
  }

  return `${webBaseUrl}/?area=${encodeURIComponent(area)}&cafeId=${encodeURIComponent(cafe.id)}`;
};

function CafeFinderContent() {
  const searchParams = useSearchParams();

  const { toast, showError, showNotice } = useToast();
  const { state, search } = useCafeSearch(showError);
  const { savedCafes, toggleSave, setStatus, getStatus } = useSavedCafes();
  const { selectedId, selectionSource, listRef, select, clear } = useMapSelection();

  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [sheetState, setSheetState] = useState<SheetState>('half');

  // 共有リンク / リロードで渡ってくる初期値。
  const initialArea = searchParams.get('area') ?? '';
  const initialCafeId = searchParams.get('cafeId');

  /** 直近に検索したエリア名。共有 URL の組み立てに使う。 */
  const [submittedArea, setSubmittedArea] = useState(initialArea);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const locationRequestId = useRef(0);

  // 近い順の並び替え。現在地が取れているときだけ意味を持つ。
  const [sortByDistance, setSortByDistance] = useState(false);

  // 検索結果の絞り込み（.pen のフィルタチップ）。押した分だけ実際に効かせる。
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [priceFilters, setPriceFilters] = useState<PriceFilterId[]>([]);

  // 保存タブのセグメント（すべて / 行きたい / 訪問済み）
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all');

  const results = state.status === 'success' ? state.results : [];
  const isLoading = state.status === 'loading';
  const hasSearched = state.status !== 'idle';
  const searchMode = state.status === 'idle' ? null : state.mode;

  const syncAreaFromCoords = useCallback(async (coords: Coordinates, replaceCurrentValue: boolean) => {
    try {
      const areaName = await getAreaFromCoords(coords.lat, coords.lng);
      if (!areaName) return;

      setSubmittedArea((prev) => (!replaceCurrentValue && prev.trim() ? prev : areaName));
    } catch {
      // 現在地検索自体は座標ベースで成立するので、逆ジオコード失敗は無視する
    }
  }, []);

  // 位置情報の取得は lib/geolocation.ts を通す（iOS では Capacitor のプラグインに
  // 差し替わる）。ここで navigator.geolocation を直接呼ばないこと。
  const updateCurrentLocation = useCallback(
    async (options: { searchNearby?: boolean; silent?: boolean } = {}) => {
      const { searchNearby = false, silent = false } = options;

      // マウント時の暗黙取得とユーザー操作が同時に走りうる。古い座標でピンを
      // 巻き戻さないよう、最後に始めた取得だけを採用する。
      const requestId = ++locationRequestId.current;

      if (searchNearby) setIsLocating(true);

      try {
        const coords = await getCurrentPosition();
        if (requestId !== locationRequestId.current) return;

        setCurrentLocation(coords);
        void syncAreaFromCoords(coords, searchNearby);

        if (!searchNearby) return;

        setIsLocating(false);
        void search({ coordinates: coords, radius: DEFAULT_NEARBY_RADIUS });
      } catch (error) {
        if (requestId !== locationRequestId.current) return;

        if (searchNearby) setIsLocating(false);
        if (!silent) {
          showError(
            error instanceof GeolocationError
              ? error.message
              : '現在地を取得できませんでした。端末の位置情報権限をご確認ください。',
          );
        }
      }
    },
    [search, showError, syncAreaFromCoords],
  );

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void updateCurrentLocation({ silent: true });
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [updateCurrentLocation]);

  // URL パラメータからの初期ロード。1 回だけ走らせる。
  const didRestoreFromUrl = useRef(false);
  useEffect(() => {
    if (didRestoreFromUrl.current || !initialArea) return;
    didRestoreFromUrl.current = true;

    void search({ area: initialArea }).then(() => {
      if (initialCafeId) select(initialCafeId, 'list');
    });
  }, [initialArea, initialCafeId, search, select]);

  const handleSearchArea = useCallback(
    (area: string) => {
      setSubmittedArea(area);
      void search({ area });
    },
    [search],
  );

  const handleCardSelect = useCallback(
    (id: string) => {
      setSheetState('full');
      select(id, 'list');
    },
    [select],
  );

  const handleMapSelect = useCallback(
    (id: string) => {
      const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
      select(id, 'map', isDesktop);
    },
    [select],
  );

  const filteredResults = results.filter(
    (cafe) => (!openNowOnly || cafe.openNow === true) && matchesPriceFilters(cafe, priceFilters),
  );
  const filteredSaved = savedCafes.filter((cafe) => savedFilter === 'all' || cafe.status === savedFilter);

  // 現在地が無ければ距離が出せないので、並び替えも成立しない。
  const canSortByDistance = currentLocation !== null;
  const currentCafes = useMemo(() => {
    const base: Cafe[] = activeTab === 'search' ? filteredResults : filteredSaved;
    if (!canSortByDistance || !sortByDistance) return base;

    return [...base].sort((a, b) => {
      const da = getDistanceMeters(currentLocation, a);
      const db = getDistanceMeters(currentLocation, b);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
    // filteredResults / filteredSaved は毎回新しい配列なので、中身で比較させる。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, results, savedCafes, openNowOnly, priceFilters, savedFilter, sortByDistance, currentLocation, canSortByDistance]);

  const selectedCafe = currentCafes.find((cafe) => cafe.id === selectedId) ?? null;

  const activeFilterCount = (openNowOnly ? 1 : 0) + priceFilters.length;
  const savedCounts = {
    all: savedCafes.length,
    want: savedCafes.filter((cafe) => cafe.status === 'want').length,
    visited: savedCafes.filter((cafe) => cafe.status === 'visited').length,
  };

  // 検索が済んだらヘッダーを畳んで、地図とリストに高さを返す。
  const isHeaderCompact = activeTab === 'saved' || hasSearched;

  const empty = emptyStateCopy({ activeTab, savedFilter, hasSearched, activeFilterCount });

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-surface text-text relative isolate">
      <Toast toast={toast} />

      <AppHeader>
        <SearchPanel
          compact={isHeaderCompact}
          isLocating={isLocating}
          isSearching={isLoading}
          initialArea={initialArea}
          onLocate={() => void updateCurrentLocation({ searchNearby: true })}
          onSearch={handleSearchArea}
        />
      </AppHeader>

      {/* 地図 + ボトムシート。PC では 2 カラムに開く。 */}
      <div className="flex-1 w-full flex md:flex-row overflow-hidden relative">
        <div
          className={`absolute inset-x-0 top-0 z-0 overflow-hidden md:static md:inset-auto md:flex-1
            ${sheetState === 'full' ? 'bottom-[88%]' : 'bottom-[52%]'}`}
        >
          <MapView
            cafes={currentCafes}
            selectedId={selectedId}
            currentLocation={currentLocation}
            emphasizeCurrentLocation={searchMode === 'nearby'}
            onSelectCafe={handleMapSelect}
            onClearSelection={clear}
          />

          {selectedCafe && selectionSource === 'map' && (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-20 md:hidden">
              <div className="pointer-events-auto">
                <MapSelectionCard
                  cafe={selectedCafe}
                  distance={getDistanceMeters(currentLocation, selectedCafe)}
                  onClose={clear}
                />
              </div>
            </div>
          )}
        </div>

        <BottomSheet state={sheetState} onChange={setSheetState}>
          {/* シート見出し（.pen の Sheet Head）。中身が無いうちは出さない。 */}
          <div
            className={`shrink-0 flex items-center justify-between gap-2 py-2 md:pt-4 ${activeTab === 'search' && !hasSearched ? 'hidden' : ''}`}
          >
            {activeTab === 'saved' ? (
              <SavedSegments value={savedFilter} onChange={setSavedFilter} counts={savedCounts} />
            ) : (
              <h2 className="text-[17px] font-bold leading-[1.4] text-text truncate">この辺りのカフェ</h2>
            )}

            {/* 並び替えは実際に効くときだけ出す（docs/design.md 1節） */}
            {canSortByDistance && currentCafes.length > 1 && (
              <button
                type="button"
                onClick={() => setSortByDistance((value) => !value)}
                aria-pressed={sortByDistance}
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${sortByDistance ? 'bg-primary text-white' : 'bg-surface-sunken text-text-muted'}`}
              >
                <SortIcon />
                近い順
              </button>
            )}
          </div>

          {activeTab === 'search' && hasSearched && results.length > 0 && (
            <FilterChips
              openNowOnly={openNowOnly}
              onToggleOpenNow={() => setOpenNowOnly((value) => !value)}
              priceFilters={priceFilters}
              onTogglePrice={(id) =>
                setPriceFilters((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
              }
            />
          )}

          {selectedCafe && (
            <div className={`shrink-0 pb-3 ${selectionSource === 'map' ? 'hidden md:block' : 'block'}`}>
              <CafeDetail
                cafe={selectedCafe}
                distance={getDistanceMeters(currentLocation, selectedCafe)}
                savedStatus={getStatus(selectedCafe.id)}
                shareTargetUrl={getCafeShareUrl(selectedCafe, submittedArea)}
                onToggleSave={() => toggleSave(selectedCafe)}
                onSetStatus={(next: SavedStatus) => setStatus(selectedCafe.id, next)}
                onClose={clear}
                onNotify={showNotice}
              />
            </div>
          )}

          <CafeList
            cafes={currentCafes}
            isLoading={isLoading}
            currentLocation={currentLocation}
            selectedId={selectedId}
            getSavedStatus={getStatus}
            onSelect={handleCardSelect}
            empty={empty}
            listRef={listRef}
          />
        </BottomSheet>
      </div>

      <TabBar
        active={activeTab}
        onChange={(next) => {
          setActiveTab(next);
          clear();
        }}
        savedCount={savedCafes.length}
      />
    </div>
  );
}

/** 空状態の文言。白紙にしない（docs/design.md 5節）。 */
function emptyStateCopy({
  activeTab,
  savedFilter,
  hasSearched,
  activeFilterCount,
}: {
  activeTab: TabId;
  savedFilter: SavedFilter;
  hasSearched: boolean;
  activeFilterCount: number;
}): { title: string; description: string } {
  if (activeTab === 'saved') {
    return {
      title:
        savedFilter === 'all'
          ? 'まだ保存したカフェはありません'
          : savedFilter === 'want'
            ? '「行きたい」はまだありません'
            : '「訪問済み」はまだありません',
      description: '気になるカフェを選んで「保存」すると、ここに並びます。',
    };
  }

  if (!hasSearched) {
    return {
      title: 'まずはエリアを決めましょう',
      description: '現在地の周辺で探すか、エリア名を入力してください。',
    };
  }

  if (activeFilterCount > 0) {
    return {
      title: '条件に合うカフェがありません',
      description: '絞り込みを外すと、ほかのカフェが表示されます。',
    };
  }

  return { title: '見つかりませんでした', description: '別のエリア名でお試しください。' };
}

export default function CafeFinder() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] w-full bg-surface flex items-center justify-center text-sm text-text-muted">
          読み込み中...
        </div>
      }
    >
      <CafeFinderContent />
    </Suspense>
  );
}
