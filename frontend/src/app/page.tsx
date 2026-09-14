"use client";

import Image from 'next/image';
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

import { ApiError, getCafePhotoUrl, searchCafes } from '@/lib/api';
import type { Cafe, Coordinates } from '@/lib/api';
import { loadSavedCafes, saveSavedCafes } from '@/lib/storage';

const MapView = dynamic(() => import('./components/MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-sunken" aria-hidden />,
});

type CafeSearchParams = {
  area?: string;
  coordinates?: Coordinates | null;
  radius?: number;
};

const DEFAULT_NEARBY_RADIUS_METERS = 1500;

const getCafeMapUrl = (cafe: Cafe) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name)}&query_place_id=${cafe.id}`;

const getCafeShareUrl = (cafe: Cafe, area: string) => {
  if (typeof window === 'undefined' || !area.trim()) {
    return getCafeMapUrl(cafe);
  }

  return `${window.location.origin}/?area=${encodeURIComponent(area)}&cafeId=${cafe.id}`;
};

const getCafeDomain = (cafe: Cafe) => {
  try {
    return new URL(cafe.websiteUri ?? '').hostname.replace('www.', '');
  } catch {
    return null;
  }
};

// Places API の primaryType（内部識別子）を日本語ラベルにする。
// 未知の型は内部識別子をそのまま見せず非表示にする。
const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'カフェ',
  coffee_shop: 'コーヒーショップ',
  tea_house: '日本茶・紅茶専門店',
  bakery: 'ベーカリー',
  dessert_shop: 'デザート・スイーツ',
  ice_cream_shop: 'アイスクリーム',
  sandwich_shop: 'サンドイッチ',
  breakfast_restaurant: 'モーニング',
  brunch_restaurant: 'ブランチ',
  juice_shop: 'ジューススタンド',
  bar: 'バー',
  restaurant: 'レストラン',
  food_store: '食料品店',
  store: 'ショップ',
};

const getCategoryLabel = (category?: string) =>
  (category && CATEGORY_LABELS[category]) ?? null;

// 現在地からの直線距離（実データ: 端末の座標 × Places の座標）
const getDistanceMeters = (from: Coordinates | null, cafe: Cafe): number | null => {
  if (!from || cafe.lat == null || cafe.lng == null) {
    return null;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(cafe.lat - from.lat);
  const dLng = toRad(cafe.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(cafe.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
};

const formatDistance = (meters: number) =>
  meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;

// --- データ取得 ---
const fetchCafes = async ({
  area,
  coordinates,
  radius = DEFAULT_NEARBY_RADIUS_METERS,
}: CafeSearchParams): Promise<{ data: Cafe[]; error: string | null }> => {
  try {
    const data = await searchCafes(
      coordinates
        ? { category: 'カフェ', location: coordinates, radius }
        : { category: 'カフェ', area: area ?? '' },
    );
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching cafes:', error);
    // ApiError のメッセージはそのままユーザーに見せてよい（レート制限など）。
    return {
      data: [],
      error:
        error instanceof ApiError
          ? error.message
          : 'カフェの検索に失敗しました。しばらく経ってから再度お試しください。',
    };
  }
};

// 座標からエリア名を取得（OpenStreetMap Nominatim）
const getAreaFromCoords = async (lat: number, lon: number): Promise<string> => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ja`,
    { headers: { 'User-Agent': 'DurianMap/1.0' } }
  );
  const data = await res.json();
  const addr = data.address;
  return addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
};

// --- メインコンポーネント (コンテンツ部) ---
function CafeFinderContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  const [area, setArea] = useState('');
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [searchMode, setSearchMode] = useState<'area' | 'nearby' | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Cafe[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedCafes, setSavedCafes] = useState<Cafe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<'map' | 'list' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // モバイル用ボトムシートの状態
  const [sheetState, setSheetState] = useState<'half' | 'full'>('half');
  const touchStartY = useRef(0);

  const listRef = useRef<HTMLDivElement>(null);

  // 選択時: マップをフォーカスし、リスト内で対象カードを見える位置へ寄せる
  const focusCafe = useCallback((id: string, source: 'map' | 'list', scrollList = true) => {
    setSelectedId(id);
    setSelectionSource(source);

    if (!scrollList) {
      return;
    }

    setTimeout(() => {
      listRef.current?.querySelector(`[data-id="${id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, []);

  const clearSelectedCafe = useCallback(() => {
    setSelectedId(null);
    setSelectionSource(null);
  }, []);

  const handleCardSelect = useCallback((id: string) => {
    setSheetState('full');
    focusCafe(id, 'list');
  }, [focusCafe]);

  const handleMapSelect = useCallback((id: string) => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

    if (isDesktop) {
      focusCafe(id, 'map');
      return;
    }

    focusCafe(id, 'map', false);
  }, [focusCafe]);

  // エラートーストの自動非表示
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // 保存済みカフェをマウント後に復元（SSRとのハイドレーション不一致を防ぐ）
  useEffect(() => {
    const loadSaved = async () => {
      setSavedCafes(await loadSavedCafes());
    };

    void loadSaved();
  }, []);

  const syncAreaFromCoords = useCallback(async (coords: Coordinates, replaceCurrentValue: boolean) => {
    try {
      const areaName = await getAreaFromCoords(coords.lat, coords.lng);
      if (!areaName) {
        return;
      }

      setArea((prev) => {
        if (!replaceCurrentValue && prev.trim()) {
          return prev;
        }

        return areaName;
      });
    } catch {
      // 現在地検索自体は座標ベースで成立するので、逆ジオコード失敗は無視する
    }
  }, []);

  const search = useCallback(async ({ area: searchArea, coordinates, radius }: CafeSearchParams) => {
    const normalizedArea = searchArea?.trim() ?? '';

    if (!coordinates && !normalizedArea) return;
    setIsLoading(true);
    setResults([]);
    setSelectedId(null);
    setSelectionSource(null);
    setHasSearched(true);
    setSearchMode(coordinates ? 'nearby' : 'area');
    setSheetState('half'); // 検索開始時にハーフに戻す
    const { data, error } = await fetchCafes({
      area: normalizedArea,
      coordinates,
      radius,
    });
    if (error) setErrorMsg(error);
    setResults(data);
    setIsLoading(false);
  }, []);

  // URLパラメータからの初期ロード処理
  useEffect(() => {
    const defaultArea = searchParams.get('area');
    const defaultCafeId = searchParams.get('cafeId');

    if (!defaultArea || hasSearched) {
      return;
    }

    const loadFromUrl = async () => {
      setArea(defaultArea);
      await search({ area: defaultArea });
      if (defaultCafeId) {
        setSelectedId(defaultCafeId);
        setTimeout(() => {
          listRef.current?.querySelector(`[data-id="${defaultCafeId}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    void loadFromUrl();
  }, [searchParams, search, hasSearched]);

  const updateCurrentLocation = useCallback((options: { searchNearby?: boolean; silent?: boolean } = {}) => {
    const { searchNearby = false, silent = false } = options;

    if (!navigator.geolocation) {
      if (!silent) {
        setErrorMsg('お使いのブラウザは位置情報取得に対応していません。');
      }
      return;
    }

    if (searchNearby) {
      setIsLocating(true);
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(coords);
        void syncAreaFromCoords(coords, searchNearby);

        if (!searchNearby) {
          return;
        }

        setIsLocating(false);
        void search({
          coordinates: coords,
          radius: DEFAULT_NEARBY_RADIUS_METERS,
        });
      },
      () => {
        if (searchNearby) {
          setIsLocating(false);
        }
        if (!silent) {
          setErrorMsg('現在地を取得できませんでした。端末とブラウザの位置情報権限をご確認ください。');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [search, syncAreaFromCoords]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      updateCurrentLocation({ silent: true });
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [updateCurrentLocation]);

  const handleLocate = () => {
    updateCurrentLocation({ searchNearby: true });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search({ area });
  };

  const handleQuickArea = (value: string) => {
    setArea(value);
    search({ area: value });
  };

  const toggleSave = (cafe: Cafe) => {
    const isAlreadySaved = savedCafes.some(c => c.id === cafe.id);
    const newSaved = isAlreadySaved
      ? savedCafes.filter(c => c.id !== cafe.id)
      : [...savedCafes, cafe];
    setSavedCafes(newSaved);
    void saveSavedCafes(newSaved);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (dy < -50) setSheetState('full'); // 上にスワイプ
    else if (dy > 50) setSheetState('half'); // 下にスワイプ
  };

  const currentCafes = activeTab === 'search' ? results : savedCafes;
  const selectedCafe = currentCafes.find((cafe) => cafe.id === selectedId) ?? null;

  // 定番エリアのオートコンプリート用リスト
  const popularAreas = ['渋谷', '新宿', '池袋', '東京', '銀座', '横浜', '鎌倉', '大阪', '京都', '福岡', '札幌', '名古屋'];
  const quickAreas = popularAreas.slice(0, 4);

  const listHeading = searchMode === 'nearby' ? 'この辺りのカフェ' : '検索結果';

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-surface text-text relative isolate">
      {/* エラートースト通知 */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 pointer-events-none w-[calc(100%-2rem)] md:w-auto flex justify-center ${errorMsg ? 'opacity-100' : 'opacity-0'}`}
      >
        {errorMsg && (
          <div className="bg-error text-white px-4 py-3 rounded-xl shadow-card text-sm font-bold flex items-center gap-2 max-w-md">
            <AlertIcon />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* ヘッダー (常に上部固定) */}
      <header className="absolute top-0 left-0 right-0 h-20 md:h-[5.5rem] bg-primary rounded-b-[24px] z-40 flex items-center gap-3 px-4 md:px-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface">
          <Image src="/logo-192.png" alt="" width={44} height={44} priority className="w-9 h-9 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl md:text-2xl font-bold text-white leading-tight">Durian Map</p>
          <p className="text-xs text-surface/90 leading-tight mt-0.5">チェーンじゃない、あの一杯へ。</p>
        </div>
      </header>

      {/* ベース用コンテナ (PCはフレックス、モバイルは重ね合わせ) */}
      <div className="flex-1 w-full flex md:flex-row mt-[4.5rem] md:mt-[5.25rem] overflow-hidden relative">

        {/* マップ (モバイルでは背景、PCでは右側) */}
        <div
          className={`absolute inset-x-0 top-0 z-0 overflow-hidden md:static md:inset-auto md:flex-1
            ${sheetState === 'full' ? 'bottom-[85vh]' : 'bottom-[45vh]'}`}
        >
          <MapView
            cafes={currentCafes}
            selectedId={selectedId}
            currentLocation={currentLocation}
            emphasizeCurrentLocation={searchMode === 'nearby'}
            onSelectCafe={handleMapSelect}
            onClearSelection={clearSelectedCafe}
          />

          {selectedCafe && selectionSource === 'map' && (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-20 md:hidden">
              <div className="pointer-events-auto">
                <MapSelectionCard
                  cafe={selectedCafe}
                  distance={getDistanceMeters(currentLocation, selectedCafe)}
                  onClose={clearSelectedCafe}
                />
              </div>
            </div>
          )}
        </div>

        {/* リストパネル (PC: 左側固定, モバイル: ボトムシート) */}
        <div
          className={`absolute inset-x-0 bottom-0 z-30 bg-surface shadow-card rounded-t-2xl border-t border-border flex flex-col transition-[height] duration-300 ease-out
            md:static md:w-[440px] md:h-full md:rounded-none md:shadow-none md:border-t-0 md:border-l md:border-border
            ${sheetState === 'full' ? 'h-[85vh]' : 'h-[45vh]'}`}
        >
          {/* ドラッグハンドル (モバイル専用) */}
          <button
            type="button"
            aria-label={sheetState === 'half' ? 'リストを広げる' : 'リストを縮める'}
            className="w-full flex justify-center items-center h-11 shrink-0 md:hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={() => setSheetState(s => s === 'half' ? 'full' : 'half')}
          >
            <span className="w-12 h-1.5 rounded-full bg-border pointer-events-none" />
          </button>

          <div className="flex-1 flex flex-col overflow-hidden px-4 md:px-5">
            {/* タブ切り替え */}
            <div className="shrink-0 flex gap-2 pt-2 pb-3 md:pt-5">
              <TabButton active={activeTab === 'search'} onClick={() => { setActiveTab('search'); setSheetState('half'); }}>
                さがす
              </TabButton>
              <TabButton active={activeTab === 'saved'} onClick={() => { setActiveTab('saved'); setSheetState('half'); }}>
                保存
                {savedCafes.length > 0 && (
                  <span className="num ml-1.5">{savedCafes.length}</span>
                )}
              </TabButton>
            </div>

            {/* 探すタブ: 検索フォーム */}
            {activeTab === 'search' && (
              <div className="shrink-0 pb-4 border-b border-border">
                {/* 最重要 CTA: 1 画面 1 つ（docs/design.md 1節） */}
                <button
                  onClick={handleLocate}
                  disabled={isLocating}
                  className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 rounded-xl bg-cta text-text text-left transition-opacity disabled:opacity-50"
                >
                  <span className="shrink-0">
                    {isLocating ? <LoadingSpinner /> : <TargetIcon />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-bold leading-tight">
                      {isLocating ? '現在地を取得中...' : '現在地の周辺で探す'}
                    </span>
                    <span className="block text-xs leading-tight mt-0.5 opacity-80">GPSでいますぐ見つける</span>
                  </span>
                  <ChevronRightIcon />
                </button>

                <form onSubmit={handleSearch} className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    list="popular-areas"
                    aria-label="検索したいエリア名"
                    placeholder="エリア名を入力（例：中目黒）"
                    className="flex-1 min-w-0 h-12 px-4 rounded-xl border border-border bg-surface-sunken text-base text-text placeholder-text-muted focus:outline-none focus:border-primary"
                  />
                  <datalist id="popular-areas">
                    {popularAreas.map(a => <option key={a} value={a} />)}
                  </datalist>
                  <button
                    type="submit"
                    disabled={isLoading || !area}
                    aria-label="このエリアで検索"
                    className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-primary text-white transition-opacity disabled:opacity-40"
                  >
                    <ArrowRightIcon />
                  </button>
                </form>

                {/* 押せるタグ = 実際にそのエリアを検索する（docs/design.md 1節） */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {quickAreas.map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => handleQuickArea(a)}
                      className="min-h-11 px-4 rounded-full border border-border bg-surface text-sm font-medium text-text"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 保存タブ: タイトル */}
            {activeTab === 'saved' && (
              <div className="shrink-0 pb-4 border-b border-border">
                <h2 className="text-2xl font-bold leading-[1.3] text-text">保存したカフェ</h2>
                <p className="text-xs text-text-muted mt-1">
                  <span className="num">{savedCafes.length}</span>軒をキープ中
                </p>
              </div>
            )}

            {selectedCafe && (
              <div className={`shrink-0 py-4 border-b border-border ${selectionSource === 'map' ? 'hidden md:block' : 'block'}`}>
                <SelectedCafePanel
                  cafe={selectedCafe}
                  area={area}
                  distance={getDistanceMeters(currentLocation, selectedCafe)}
                  isSaved={savedCafes.some((cafe) => cafe.id === selectedCafe.id)}
                  onToggleSave={() => toggleSave(selectedCafe)}
                  onClose={clearSelectedCafe}
                />
              </div>
            )}

            {/* カフェリスト (スクロール領域) */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto py-4 flex flex-col gap-3 scroll-smooth"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >

              {/* ローディング */}
              {isLoading && (
                <div className="flex flex-col gap-3 animate-pulse" aria-hidden>
                  {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-sunken shrink-0" />)}
                </div>
              )}

              {/* 結果 */}
              {!isLoading && currentCafes.length > 0 && (
                <>
                  {activeTab === 'search' && (
                    <div className="flex items-baseline gap-2 shrink-0">
                      <h2 className="text-lg font-bold leading-[1.4] text-text">{listHeading}</h2>
                      <span className="num text-sm text-text-muted">{results.length}件</span>
                    </div>
                  )}
                  {currentCafes.map(cafe => (
                    <CafeCard
                      key={cafe.id}
                      cafe={cafe}
                      distance={getDistanceMeters(currentLocation, cafe)}
                      isSelected={cafe.id === selectedId}
                      onSelect={() => handleCardSelect(cafe.id)}
                    />
                  ))}
                </>
              )}

              {/* 空状態 */}
              {!isLoading && currentCafes.length === 0 && (activeTab === 'saved' || hasSearched) && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-surface-sunken flex items-center justify-center mb-4 text-primary">
                    <CupIcon className="w-8 h-8" />
                  </div>
                  <p className="text-base font-bold text-text">
                    {activeTab === 'saved' ? 'まだ保存したカフェはありません' : '見つかりませんでした'}
                  </p>
                  <p className="text-sm text-text-muted mt-2 leading-[1.6]">
                    {activeTab === 'saved'
                      ? '気になるカフェを選んで「保存」すると、ここに並びます。'
                      : '別のエリア名でお試しください。'}
                  </p>
                </div>
              )}

              {/* 未検索の初期状態 */}
              {!isLoading && activeTab === 'search' && !hasSearched && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-surface-sunken flex items-center justify-center mb-4 text-primary">
                    <CupIcon className="w-8 h-8" />
                  </div>
                  <p className="text-base font-bold text-text">まずはエリアを決めましょう</p>
                  <p className="text-sm text-text-muted mt-2 leading-[1.6]">
                    現在地の周辺で探すか、エリア名を入力してください。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- メインコンポーネントのラッパー ---
export default function CafeFinder() {
  return (
    <Suspense fallback={<div className="h-[100dvh] w-full bg-surface flex items-center justify-center text-sm text-text-muted">読み込み中...</div>}>
      <CafeFinderContent />
    </Suspense>
  );
}

// --- カフェカードコンポーネント ---
type CafeCardProps = {
  cafe: Cafe;
  distance: number | null;
  isSelected: boolean;
  onSelect: () => void;
};

// カード全体がタップ領域。カード内に別のボタンは置かない（docs/design.md 5節）
function CafeCard({ cafe, distance, isSelected, onSelect }: CafeCardProps) {
  const photoUrl = getCafePhotoUrl(cafe);

  return (
    <button
      type="button"
      data-id={cafe.id}
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`w-full text-left shrink-0 rounded-2xl border p-3 flex gap-3 items-start shadow-card ${isSelected ? 'border-primary bg-surface-sunken' : 'border-border bg-surface'}`}
    >
      {/* サムネイル 64x64 / 角丸 12px */}
      <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-surface-sunken flex items-center justify-center text-text-muted">
        {photoUrl ? (
          <Image src={photoUrl} alt="" width={64} height={64} unoptimized className="w-full h-full object-cover" />
        ) : (
          <CupIcon className="w-7 h-7" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 min-w-0 text-base font-bold leading-[1.4] text-text line-clamp-2">{cafe.name}</h3>
          <OpenStatusBadge openNow={cafe.openNow} />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-text-muted">
          {cafe.rating != null && (
            <span className="inline-flex items-center gap-1">
              <StarIcon className="w-3.5 h-3.5 text-star" />
              <span className="num text-sm font-bold text-text">{cafe.rating.toFixed(1)}</span>
              {cafe.userRatingCount != null && (
                <span className="num">({cafe.userRatingCount})</span>
              )}
            </span>
          )}
          {distance != null && (
            <>
              {cafe.rating != null && <span aria-hidden>・</span>}
              <span className="num">{formatDistance(distance)}</span>
            </>
          )}
        </div>

        <p className="text-sm leading-[1.6] text-text-muted mt-1 line-clamp-1">{cafe.address}</p>
      </div>
    </button>
  );
}

// 状態バッジ: 枠線・影・ホバーなし（docs/design.md 5節）
function OpenStatusBadge({ openNow }: { openNow?: boolean }) {
  if (openNow === undefined) {
    return null;
  }

  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium leading-none ${openNow ? 'bg-success-soft text-success-text' : 'bg-accent-soft text-accent-text'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${openNow ? 'bg-success' : 'bg-accent'}`} />
      {openNow ? '営業中' : '準備中'}
    </span>
  );
}

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.round(rating);

  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={`w-4 h-4 ${i <= filled ? 'text-star' : 'text-border'}`} />
      ))}
    </span>
  );
}

function SelectedCafePanel({ cafe, area, distance, isSaved, onToggleSave, onClose }: {
  cafe: Cafe;
  area: string;
  distance: number | null;
  isSaved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}) {
  const mapUrl = getCafeMapUrl(cafe);
  const domain = getCafeDomain(cafe);
  const photoUrl = getCafePhotoUrl(cafe);
  const categoryLabel = getCategoryLabel(cafe.category);

  const handleShare = async () => {
    const shareUrl = getCafeShareUrl(cafe, area);

    if (navigator.share) {
      try {
        await navigator.share({
          title: cafe.name,
          url: shareUrl,
        });
      } catch { }
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    alert('URLをコピーしました！');
  };

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      {photoUrl && (
        <div className="relative h-32 w-full bg-surface-sunken">
          <Image src={photoUrl} alt="" width={400} height={160} unoptimized className="h-full w-full object-cover" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="flex-1 min-w-0 text-lg font-bold leading-[1.4] text-text">{cafe.name}</h2>
              <OpenStatusBadge openNow={cafe.openNow} />
            </div>
            {(categoryLabel || distance != null) && (
              <p className="mt-1 text-sm leading-[1.6] text-text-muted">
                {categoryLabel}
                {categoryLabel && distance != null && <span aria-hidden>　・　</span>}
                {distance != null && <span className="num">現在地から{formatDistance(distance)}</span>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="選択を解除"
            className="h-11 w-11 -mr-2 -mt-2 shrink-0 flex items-center justify-center rounded-full text-text-muted"
          >
            <CloseIcon />
          </button>
        </div>

        {cafe.rating != null && (
          <div className="mt-3 flex items-center gap-2">
            <span className="num text-2xl font-bold leading-none text-text">{cafe.rating.toFixed(1)}</span>
            <RatingStars rating={cafe.rating} />
            {cafe.userRatingCount != null && (
              <span className="text-xs text-text-muted">
                <span className="num">{cafe.userRatingCount}</span>件のクチコミ
              </span>
            )}
          </div>
        )}

        {/* アクション行（アイコン + ラベルの縦積みはここだけ / docs/design.md 5節） */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl bg-primary text-white text-xs font-bold"
          >
            <LocationIcon className="w-5 h-5" />
            地図でみる
          </a>
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={isSaved}
            className={`min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold ${isSaved ? 'border-accent bg-accent-soft text-accent-text' : 'border-border bg-surface text-text'}`}
          >
            <BookmarkIcon filled={isSaved} />
            {isSaved ? '保存済み' : '保存'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface text-xs font-bold text-text"
          >
            <ShareIcon className="w-5 h-5" />
            シェア
          </button>
        </div>

        <div className="mt-4 border-t border-border">
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 py-3 min-h-11 border-b border-border"
          >
            <LocationIcon className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-text-muted">住所</span>
              <span className="block text-sm leading-[1.6] text-text">{cafe.address}</span>
            </span>
            <ChevronRightIcon className="w-4 h-4 shrink-0 mt-1 text-text-muted" />
          </a>

          {domain && cafe.websiteUri && (
            <a
              href={cafe.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 py-3 min-h-11"
            >
              <LinkIcon className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-text-muted">ウェブサイト</span>
                <span className="block text-sm leading-[1.6] text-text truncate">{domain}</span>
              </span>
              <ChevronRightIcon className="w-4 h-4 shrink-0 mt-1 text-text-muted" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function MapSelectionCard({ cafe, distance, onClose }: { cafe: Cafe; distance: number | null; onClose: () => void }) {
  const photoUrl = getCafePhotoUrl(cafe);

  return (
    <section className="rounded-2xl border border-border bg-surface p-3 shadow-card">
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-sunken flex items-center justify-center text-text-muted">
          {photoUrl ? (
            <Image src={photoUrl} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" />
          ) : (
            <CupIcon className="w-7 h-7" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 min-w-0 text-base font-bold leading-[1.4] text-text line-clamp-1">{cafe.name}</h3>
            <OpenStatusBadge openNow={cafe.openNow} />
            <button
              type="button"
              onClick={onClose}
              aria-label="選択を解除"
              className="h-11 w-11 -mr-2 -mt-2 shrink-0 flex items-center justify-center rounded-full text-text-muted"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            {cafe.rating != null && (
              <span className="inline-flex items-center gap-1">
                <StarIcon className="w-3.5 h-3.5 text-star" />
                <span className="num text-sm font-bold text-text">{cafe.rating.toFixed(1)}</span>
                {cafe.userRatingCount != null && <span className="num">({cafe.userRatingCount})</span>}
              </span>
            )}
            {distance != null && (
              <>
                {cafe.rating != null && <span aria-hidden>・</span>}
                <span className="num">{formatDistance(distance)}</span>
              </>
            )}
          </div>

          <p className="mt-1 text-sm leading-[1.6] text-text-muted line-clamp-1">{cafe.address}</p>
        </div>
      </div>
    </section>
  );
}

// --- 小コンポーネント ---
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 inline-flex items-center px-5 rounded-full text-sm font-bold border ${active
        ? 'border-primary bg-primary text-white'
        : 'border-border bg-surface text-text'
        }`}
    >
      {children}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function LocationIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="7" strokeWidth={2} />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function CupIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h12v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 9h2.5a2.5 2.5 0 010 5H16" />
      <path strokeLinecap="round" strokeWidth={2} d="M8 2.5v2M12 2.5v2" />
    </svg>
  );
}

function StarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function LinkIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-5 h-5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4.5A1.5 1.5 0 016.5 3h11A1.5 1.5 0 0119 4.5V21l-7-4-7 4V4.5z" />
    </svg>
  );
}

function ShareIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 7.5v5M12 16h.01" />
    </svg>
  );
}
