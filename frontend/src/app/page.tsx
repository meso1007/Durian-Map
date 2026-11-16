'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Cafe, Coordinates } from '@/lib/api';
import { getMapInsets, getSheetHeights } from '@/lib/layout';
import { shareText } from '@/lib/share';
import { buildShareText, decodeSharedList, encodeSharedList, guessListTitle } from '@/lib/sharedList';
import type { SheetSnap } from '@/lib/sheet';
import { CAFE_PHOTO_TRANSITION, findCardPhoto, withViewTransition } from '@/lib/viewTransition';

import { useCafeFilters } from '@/hooks/useCafeFilters';
import { DEFAULT_NEARBY_RADIUS, useCafeSearch } from '@/hooks/useCafeSearch';
import type { SearchQuery, SearchRadius } from '@/hooks/useCafeSearch';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useMapSelection, useSelectedCafe } from '@/hooks/useMapSelection';
import { useRecentAreas } from '@/hooks/useRecentAreas';
import { useSavedCafes } from '@/hooks/useSavedCafes';
import { areaQuery, buildCafeShareUrl, buildShareUrl, useInitialSearchUrl, useRestoreSearchFromUrl, useSearchUrlState } from '@/hooks/useSearchUrlState';
import { useToast } from '@/hooks/useToast';
import { useViewport } from '@/hooks/useViewport';

import AskAi from './components/AskAi';
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
  const { toast, showError, showNotice, dismissToast } = useToast();
  const { state: searchState, query, search, reset: resetSearch, completedCount, results, isLoading, hasSearched } = useCafeSearch(showError);

  // URL を状態の正にする。マウント時の URL が初期状態になり、以降は状態が変わるたびに
  // 書き戻す（リロードでも共有リンクでも同じ画面に戻る）。
  const initialUrl = useInitialSearchUrl();
  const [tab, setTab] = useState<TabId>(initialUrl.tab);
  const [snap, setSnap] = useState<SheetSnap>('half');

  const { selectedId, listRef, select, clear, dismiss } = useMapSelection(initialUrl.cafeId);
  // ホームへ戻ったあとは、開いたときの URL の検索条件を引き継がない。
  const [wentHome, setWentHome] = useState(false);
  const fallbackQuery = wentHome ? null : initialUrl.query;

  // 友達から送られた一覧（?list=…）。自分で検索するか、ホームへ戻るまで出しておく。
  const [sharedList, setSharedList] = useState(() => decodeSharedList(initialUrl.list));
  const showingShared = sharedList !== null && query === null && fallbackQuery === null;

  const urlState = {
    tab,
    query: query ?? fallbackQuery,
    cafeId: selectedId,
    list: showingShared ? initialUrl.list : null,
  };

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

  const { savedCafes, toggleSave, setStatus, getStatus, saveMany } = useSavedCafes({
    onError: showError,
    onNotice: showNotice,
  });
  const savedIds = useMemo(() => new Set(savedCafes.map((cafe) => cafe.id)), [savedCafes]);

  const filters = useCafeFilters({ tab, results: showingShared ? sharedList.cafes : results, savedCafes, currentLocation });
  const selectedCafe = useSelectedCafe(selectedId, filters.cafes);

  // 共有 URL。検索条件がまだ無ければ、逆ジオで引いた地名で代用する。
  const shareTargetUrl = selectedCafe
    ? buildCafeShareUrl(
        urlState.query ? urlState : { ...urlState, query: areaQuery(resolvedAreaName) },
        selectedCafe,
      )
    : null;

  // 検索欄に出すエリア名。現在地からの検索に切り替えたら空にする（前のエリア名を残さない）。
  const shownQuery = query ?? fallbackQuery;
  const searchArea = shownQuery?.kind === 'area' ? shownQuery.area : '';
  const searchTitle = showingShared
    ? sharedList.title
    : query?.kind === 'nearby'
      ? 'この辺りのカフェ'
      : searchArea
        ? `${searchArea}のカフェ`
        : 'カフェ';

  /** 保存の一覧（いま絞り込んで見えている分）を、文章とリンクにして友達に送る。 */
  const shareSavedList = useCallback(async () => {
    const list = { title: guessListTitle(filters.cafes), cafes: filters.cafes };
    const base = buildShareUrl({ tab: 'search', query: null, cafeId: null, list: encodeSharedList(list) });

    const result = await shareText({
      title: list.title,
      text: buildShareText(list),
      url: base ?? 'https://durian-map.pages.dev/',
    });

    if (result === 'copied') showNotice('一覧をコピーしました。貼り付けて送れます');
    else if (result === 'failed') showError('共有できませんでした');
  }, [filters.cafes, showNotice, showError]);

  // 見出しの右の操作。保存の一覧では「友達に送る」、送られてきた一覧では「すべて保存」。
  const listAction =
    tab === 'saved' && filters.cafes.length > 0
      ? { label: '友達に送る', onClick: () => void shareSavedList() }
      : tab === 'search' && showingShared
        ? { label: 'すべて保存', onClick: () => void saveMany(sharedList.cafes) }
        : undefined;

  // カードに渡すコールバックを作り直さないよう、段と画面幅は ref で読む
  // （作り直すと、シートを動かすたびにカード 20 枚が再描画される）。
  const layoutRef = useRef({ isDesktop: viewport.isDesktop, snap });
  useEffect(() => {
    layoutRef.current = { isDesktop: viewport.isDesktop, snap };
  }, [viewport.isDesktop, snap]);

  // 共有リンクの店が、いまの検索結果に居なかった。選択を残すと URL に店の id だけが残り、
  // 何も開いていないのに「選択中」になるので、解いて理由を伝える。
  const searchSucceeded = searchState.status === 'success';
  useEffect(() => {
    if (tab === 'search' && searchSucceeded && selectedId && !selectedCafe) {
      clear();
      showNotice('リンクのカフェは、いまの検索結果にありませんでした');
    }
  }, [tab, searchSucceeded, selectedId, selectedCafe, clear, showNotice]);

  /**
   * 一覧 → 詳細。カードの写真が詳細の大きな写真へそのまま広がるようにつなぐ。
   * シートの段が同時に変わる場合（モバイルで半分 → 全面）は、移動先の位置が定まらないのでつながない。
   */
  const handleSelectFromList = useCallback(
    (id: string) => {
      const open = () => {
        select(id, 'list');
        setSnap('full');
      };

      const { isDesktop, snap: currentSnap } = layoutRef.current;
      const photo = isDesktop || currentSnap === 'full' ? findCardPhoto(listRef.current, id) : null;
      if (!photo) {
        open();
        return;
      }

      photo.style.viewTransitionName = CAFE_PHOTO_TRANSITION;
      withViewTransition(() => {
        // 遷移後の画面では、この名前は詳細の写真だけが持つ（2 つあると遷移が中断される）。
        photo.style.viewTransitionName = '';
        open();
      });
    },
    [select, listRef],
  );

  /** 詳細 → 一覧。逆向きに、詳細の写真を元のカードの写真へ戻す。 */
  const closeDetail = useCallback(() => {
    const photo = selectedId ? findCardPhoto(listRef.current, selectedId) : null;
    if (!photo) {
      dismiss();
      return;
    }

    withViewTransition(
      () => {
        dismiss();
        photo.style.viewTransitionName = CAFE_PHOTO_TRANSITION;
      },
      () => {
        photo.style.viewTransitionName = '';
      },
    );
  }, [selectedId, listRef, dismiss]);

  // 地図のピンから選んだときは半分まで。選んだ店が地図に見えたままになる。
  const handleSelectFromMap = useCallback(
    (id: string) => {
      select(id, 'map');
      setSnap('half');
    },
    [select],
  );

  /** ロゴを押した。検索と選択を解いて、最初の画面へ戻る。 */
  const goHome = useCallback(() => {
    clear();
    resetSearch();
    setWentHome(true);
    setSharedList(null);
    setTab('search');
    setSnap('half');
  }, [clear, resetSearch]);

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
      if (event.key === 'Escape') closeDetail();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, closeDetail]);

  return (
    <main className="relative isolate h-dvh w-full overflow-hidden bg-map-land text-text">
      <MapArea
        cafes={filters.cafes}
        selectedId={selectedId}
        savedIds={savedIds}
        currentLocation={currentLocation}
        includeCurrentLocation={query?.kind === 'nearby'}
        insets={insets}
        searchToken={completedCount}
        onSelectCafe={handleSelectFromMap}
        onClearSelection={clear}
        onSearchThisArea={(coordinates: Coordinates, radius: SearchRadius) =>
          startSearch({ kind: 'nearby', coordinates, radius })
        }
        onError={showError}
      />

      <AskAi
        insets={insets}
        onNotify={showNotice}
        context={{
          url: buildShareUrl(urlState) ?? 'https://durian-map.pages.dev/',
          title: tab === 'saved' ? '保存したカフェ' : hasSearched || showingShared ? searchTitle : null,
          cafes: filters.cafes,
          selected: selectedCafe,
        }}
      />

      {/*
        地図の上に浮く UI。モバイルでは検索バー（上）とシート（下）が別々に浮き、
        PC では左の列に縦につながって 1 枚の面になる。列そのものは地図の操作を邪魔しない（pointer-events-none）。
      */}
      <div className="pointer-events-none absolute inset-0 z-10 md:right-auto md:flex md:w-[416px] md:flex-col md:p-4 lg:w-[448px]">
        <SearchBar
          area={searchArea}
          recentAreas={recentAreas}
          isLocating={isLocating}
          isSearching={isLoading}
          showLocate={hasSearched || showingShared || tab === 'saved'}
          // 最重要 CTA（マンゴー）は 1 画面 1 つ。詳細では「ここへ行く」が主役なので、現在地ボタンは控えめにする。
          emphasizeLocate={tab === 'search' && selectedCafe === null}
          onLocate={locate}
          onSearch={(area) => startSearch({ kind: 'area', area })}
          onHome={goHome}
        />

        <Sheet
          snap={snap}
          heights={sheetHeights}
          draggable={!viewport.isDesktop}
          onSnapChange={setSnap}
          header={
            // 詳細が開いている間は切り替えを畳む（詳細は 1 段深い画面で、上にタブが残ると戻り先が曖昧になる）。
            // tabpanel が aria-labelledby で参照するので、DOM からは外さない。
            <div hidden={selectedCafe !== null}>
              <ViewSwitch active={tab} onChange={handleTabChange} savedCount={savedCafes.length} />
            </div>
          }
        >
          <Panel
            tab={tab}
            filters={filters}
            searchTitle={searchTitle}
            hasSearched={hasSearched || showingShared}
            isLoading={isLoading}
            // 送られてきた一覧には営業時間も価格帯も無いので、絞り込みは出さない。
            hasResults={!showingShared && results.length > 0}
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
            listAction={listAction}
            onSelect={handleSelectFromList}
            onToggleSave={(cafe: Cafe) => void toggleSave(cafe)}
            onSetStatus={(cafeId, status) => void setStatus(cafeId, status)}
            onCloseDetail={closeDetail}
            onNotify={showNotice}
            listRef={listRef}
          />
        </Sheet>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </main>
  );
}

// 静的書き出しの HTML に入る最初の絵。地図の色で埋め、すぐに本体へ差し替わる。
const LOADING = <div className="h-dvh w-full bg-map-land" aria-hidden />;

// useSearchParams は Suspense の内側でしか使えない（静的書き出しでも同じ）。
export default function CafeFinder() {
  return <Suspense fallback={LOADING}><CafeFinderContent /></Suspense>;
}
