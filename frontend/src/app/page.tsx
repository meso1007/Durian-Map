"use client";

import Image from 'next/image';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

// SSR無効でMapViewを読み込む（Leafletはブラウザ専用ではないが、Google Mapsと合わせて一応）
const MapView = dynamic(() => import('./components/MapView'), { ssr: false });

type Cafe = {
  id: string;
  name: string;
  address: string;
  category?: string;
  websiteUri?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  userRatingCount?: number;
  openNow?: boolean;
  photoName?: string;
};

type Coordinates = {
  lat: number;
  lng: number;
};

type SearchResponse = {
  leads?: Cafe[];
  error?: string;
};

type CafeSearchParams = {
  area?: string;
  coordinates?: Coordinates | null;
  radius?: number;
};

const DEFAULT_NEARBY_RADIUS_METERS = 1500;

const getCafeMapUrl = (cafe: Cafe) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name)}&query_place_id=${cafe.id}`;

const getCafeDomain = (cafe: Cafe) => {
  try {
    return new URL(cafe.websiteUri ?? '').hostname.replace('www.', '');
  } catch {
    return null;
  }
};

const getCafePhotoUrl = (cafe: Cafe) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!cafe.photoName || !apiKey) {
    return null;
  }

  return `https://places.googleapis.com/v1/${cafe.photoName}/media?maxHeightPx=400&maxWidthPx=400&key=${apiKey}`;
};

// --- データ取得 ---
const fetchCafes = async ({
  area,
  coordinates,
  radius = DEFAULT_NEARBY_RADIUS_METERS,
}: CafeSearchParams): Promise<{ data: Cafe[]; error: string | null }> => {
  try {
    const apiUrlBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const params = new URLSearchParams({ category: 'カフェ' });

    if (coordinates) {
      params.set('lat', String(coordinates.lat));
      params.set('lng', String(coordinates.lng));
      params.set('radius', String(radius));
    } else if (area) {
      params.set('area', area);
    }

    const response = await fetch(`${apiUrlBase}/api/search?${params.toString()}`);
    if (!response.ok) throw new Error('API request failed');
    const data = await response.json() as SearchResponse;
    if (data.error) throw new Error(data.error);
    return { data: data.leads || [], error: null };
  } catch (error) {
    console.error('Error fetching cafes:', error);
    return { data: [], error: 'カフェの検索に失敗しました。しばらく経ってから再度お試しください。' };
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

// --- メインコンポーネント ---
export default function CafeFinder() {
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  const [area, setArea] = useState('');
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [searchMode, setSearchMode] = useState<'area' | 'nearby' | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Cafe[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedCafes, setSavedCafes] = useState<Cafe[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem('saved_cafes');
      return stored ? JSON.parse(stored) as Cafe[] : [];
    } catch {
      return [];
    }
  });
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

  const toggleSave = (cafe: Cafe) => {
    const isAlreadySaved = savedCafes.some(c => c.id === cafe.id);
    const newSaved = isAlreadySaved
      ? savedCafes.filter(c => c.id !== cafe.id)
      : [...savedCafes, cafe];
    setSavedCafes(newSaved);
    localStorage.setItem('saved_cafes', JSON.stringify(newSaved));
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

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden text-[var(--foreground)] relative isolate">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 -top-14 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,250,220,0.95),rgba(183,218,82,0.34)_45%,transparent_72%)] blur-xl" />
        <div className="absolute right-[-3.5rem] top-24 h-36 w-36 bg-[linear-gradient(180deg,rgba(151,207,62,0.42),rgba(69,99,30,0.14))] opacity-70 [clip-path:polygon(50%_0%,64%_12%,82%_10%,92%_28%,100%_50%,88%_70%,92%_88%,70%_92%,50%_100%,30%_92%,8%_88%,12%_70%,0%_50%,8%_28%,18%_10%,36%_12%)]" />
        <div className="absolute bottom-20 left-[-2rem] h-40 w-40 rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(246,238,190,0.92),rgba(237,197,72,0.3)_44%,transparent_76%)] blur-2xl" />
      </div>

      {/* エラートースト通知 */}
      <div className={`fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-400 pointer-events-none w-[90%] md:w-auto flex justify-center ${errorMsg ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
        <div className="bg-[#2f4519]/95 backdrop-blur text-[#fff9df] px-5 py-3 rounded-[22px] border border-[#a7c854]/40 shadow-[0_18px_40px_rgba(68,99,28,0.28)] text-sm font-medium flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f5d75b] text-[#31471a] text-xs font-extrabold">!</span>
          {errorMsg}
        </div>
      </div>

      {/* ヘッダー (常に上部固定) */}
      <header className="absolute top-0 left-0 right-0 h-[4.5rem] md:h-[5.15rem] bg-[rgba(250,244,210,0.9)] backdrop-blur-xl border-b border-[#d9cd88] z-40 flex items-center justify-between px-4 md:px-6 shadow-[0_18px_45px_rgba(83,110,29,0.18)]">
        <div className="flex items-center gap-2.5 md:gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#90be3b] bg-[linear-gradient(180deg,#b7da52_0%,#7eae33_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_20px_rgba(97,128,34,0.22)]">
            <div className="absolute inset-1 rounded-[14px] bg-[radial-gradient(circle_at_35%_35%,rgba(255,251,224,0.86),rgba(242,221,115,0.22)_48%,transparent_70%)]" />
            <Image src="/logo.png" alt="Durian Map Logo" width={44} height={44} priority className="relative z-10 w-9 h-9 md:w-10 md:h-10 object-contain drop-shadow-sm" />
          </div>
          <div className="flex items-baseline gap-2 md:gap-2.5">
            <span className="font-display font-bold text-[#284117] tracking-tight text-lg md:text-[1.65rem]">Durian Map</span>
            <span className="text-[10px] text-[#45631e] font-bold px-2.5 py-1 rounded-full border border-[#c8dd74] bg-[#eff7c8] hidden sm:inline-block shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] font-display">NO CHAINS</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <TabButton active={activeTab === 'search'} onClick={() => { setActiveTab('search'); setSheetState('half'); }}>
            探す
          </TabButton>
          <TabButton active={activeTab === 'saved'} onClick={() => { setActiveTab('saved'); setSheetState('half'); }}>
            保存
            {savedCafes.length > 0 && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-px rounded-full font-bold ${activeTab === 'saved' ? 'bg-[#f7e8a0] text-[#567221]' : 'bg-[#efe5bb] text-[#71804b]'
                }`}>
                {savedCafes.length}
              </span>
            )}
          </TabButton>
        </div>
      </header>

      {/* ベース用コンテナ (PCはフレックス、モバイルは重ね合わせ) */}
      <div className="flex-1 w-full flex md:flex-row mt-[4.25rem] md:mt-[5rem] overflow-hidden relative">

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
            <div className="pointer-events-none absolute inset-x-3 top-3 z-20 md:hidden">
              <div className="pointer-events-auto">
                <MapSelectionCard cafe={selectedCafe} onClose={clearSelectedCafe} />
              </div>
            </div>
          )}
        </div>

        {/* リストパネル (PC: 左側固定, モバイル: ボトムシート) */}
        <div
          className={`absolute inset-x-0 bottom-0 z-30 bg-[rgba(253,248,223,0.97)] shadow-[0_-18px_45px_rgba(71,98,29,0.18)] rounded-t-[2rem] border-t border-[#d9cc88] flex flex-col transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]
            md:static md:w-[440px] md:h-full md:rounded-none md:shadow-none md:border-r md:border-[#d6ca8c] md:bg-[rgba(252,247,221,0.92)] md:backdrop-blur-xl md:z-auto
            ${sheetState === 'full' ? 'h-[85vh]' : 'h-[45vh]'}`}
        >
          {/* ドラッグハンドル (モバイル専用) */}
          <div
            className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing md:hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={() => setSheetState(s => s === 'half' ? 'full' : 'half')}
          >
            <div className="w-14 h-2 rounded-full bg-[linear-gradient(90deg,#567822_0%,#8fc63c_50%,#567822_100%)] shadow-[0_3px_10px_rgba(93,123,39,0.28)] pointer-events-none" />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden px-4 md:px-5">
            {/* 探すタブ: 検索フォーム */}
            {activeTab === 'search' && (
              <div className="shrink-0 pt-2 pb-4 border-b border-[#e1d8aa] md:pt-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="hidden md:block text-[11px] uppercase tracking-[0.22em] text-[#7f9452] font-bold font-display">Creamy Search</p>
                    <h2 className="text-base md:text-lg font-extrabold text-[#284117] mt-1">エリアから候補を探す</h2>
                  </div>
                  {currentLocation && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef8c9] px-3 py-1 text-[11px] font-bold text-[#496820] border border-[#c7df70] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <span className="w-2 h-2 rounded-full bg-[#7cb930] shadow-[0_0_0_4px_rgba(183,218,82,0.25)]" />
                      現在地を表示中
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLocate}
                  disabled={isLocating}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[24px] border border-[#5f8128] bg-[linear-gradient(180deg,#a4d348_0%,#6d962a_100%)] text-[#fff9df] text-sm font-extrabold hover:brightness-[1.02] hover:translate-y-[1px] transition-all mb-3 disabled:opacity-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_28px_rgba(93,123,39,0.24)]"
                >
                  {isLocating ? <><LoadingSpinner />現在地を取得中...</> : <><LocationIcon />現在地周辺で探す</>}
                </button>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    list="popular-areas"
                    aria-label="検索したいエリア名"
                    placeholder="例: 新宿、渋谷、鎌倉"
                    className="flex-1 px-4 py-2.5 rounded-[22px] border border-[#d9cd88] bg-[#fff9df] text-sm text-[#284117] placeholder-[#8f956d] focus:outline-none focus:ring-2 focus:ring-[#b8d95c]/55 focus:border-[#8fc63c] focus:bg-[#fffdf2] transition-all shadow-[inset_0_2px_10px_rgba(115,132,51,0.06)]"
                  />
                  <datalist id="popular-areas">
                    {popularAreas.map(a => <option key={a} value={a} />)}
                  </datalist>
                  <button
                    type="submit"
                    disabled={isLoading || !area}
                    className="px-5 py-2.5 rounded-[22px] border border-[#b98c24] bg-[linear-gradient(180deg,#f6de69_0%,#ecbd42_100%)] text-[#42330f] text-sm font-extrabold hover:brightness-[1.02] transition-all disabled:opacity-40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_12px_22px_rgba(215,173,55,0.22)]"
                  >
                    検索
                  </button>
                </form>
                <p className="mt-3 text-[11px] md:text-xs text-[#667931] leading-relaxed font-medium">
                  {searchMode === 'nearby'
                    ? `現在地から半径${(DEFAULT_NEARBY_RADIUS_METERS / 1000).toFixed(1)}km圏内を距離順で表示しています。`
                    : 'ピンでも一覧でも選べます。一覧をタップすると詳細を大きく表示します。'}
                </p>
              </div>
            )}

            {/* お気に入りタブ: タイトル */}
            {activeTab === 'saved' && (
              <div className="shrink-0 py-4 md:pt-6 border-b border-[#e1d8aa]">
                <h2 className="font-extrabold text-lg text-[#284117]">保存したカフェ</h2>
              </div>
            )}

            {selectedCafe && (
              <div className={`shrink-0 py-3 md:py-4 border-b border-[#e1d8aa] ${selectionSource === 'map' ? 'hidden md:block' : 'block'}`}>
                <SelectedCafePanel
                  cafe={selectedCafe}
                  isSaved={savedCafes.some((cafe) => cafe.id === selectedCafe.id)}
                  onToggleSave={() => toggleSave(selectedCafe)}
                  onClose={clearSelectedCafe}
                />
              </div>
            )}

            {/* カフェリスト (スクロール領域) */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-4 flex flex-col gap-3 scroll-smooth pb-10">

              {/* ローディング */}
              {isLoading && (
                <div className="flex flex-col gap-3 animate-pulse">
                  {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-[24px] bg-[#f4edc8]" />)}
                </div>
              )}

              {/* 結果 */}
              {!isLoading && currentCafes.length > 0 && (
                <>
                  {activeTab === 'search' && (
                    <div className="flex items-center justify-between mb-1">
                      <p className="inline-flex items-center gap-2 rounded-full border border-[#d1e37c] bg-[#eff7c9] px-3 py-1 text-xs font-extrabold text-[#526c22] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                        <span className="h-2 w-2 rounded-full bg-[#89bf34]" />
                        {results.length}件見つかりました
                      </p>
                    </div>
                  )}
                  {currentCafes.map(cafe => (
                    <CafeCard
                      key={cafe.id}
                      cafe={cafe}
                      isSelected={cafe.id === selectedId}
                      isSaved={savedCafes.some(c => c.id === cafe.id)}
                      onSelect={() => handleCardSelect(cafe.id)}
                      onToggleSave={() => toggleSave(cafe)}
                    />
                  ))}
                </>
              )}

              {/* 空状態 */}
              {!isLoading && currentCafes.length === 0 && (activeTab === 'saved' || hasSearched) && (
                <div className="flex flex-col items-center justify-center py-20 text-[#738448]">
                  <div className="w-16 h-16 bg-[linear-gradient(180deg,#b8da52_0%,#88b834_100%)] rounded-[24px] flex items-center justify-center mb-4 text-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_24px_rgba(87,118,33,0.2)] border border-[#6f922d]">
                    ☕️
                  </div>
                  <p className="text-sm font-bold text-[#45631e]">
                    {activeTab === 'saved' ? 'まだ保存したカフェはありません' : '見つかりませんでした'}
                  </p>
                  <p className="text-xs text-[#7b8a52] mt-1">
                    {activeTab === 'search' && '別のエリア名でお試しください。'}
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

// --- カフェカードコンポーネント ---
type CafeCardProps = {
  cafe: Cafe;
  isSelected: boolean;
  isSaved: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
};

function CafeCard({ cafe, isSelected, isSaved, onSelect, onToggleSave }: CafeCardProps) {
  const mapUrl = getCafeMapUrl(cafe);
  const domain = getCafeDomain(cafe);
  const photoUrl = getCafePhotoUrl(cafe);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: cafe.name,
          url: mapUrl
        });
      } catch { }
    } else {
      navigator.clipboard.writeText(mapUrl);
      alert('マップURLをコピーしました！');
    }
  };

  return (
    <div
      data-id={cafe.id}
      onClick={onSelect}
      className={`rounded-[28px] md:rounded-[26px] px-3.5 py-3 md:p-4 flex gap-3 md:gap-4 cursor-pointer transition-all duration-300 group border relative overflow-hidden shrink-0 ${isSelected
        ? 'border-[#8fc63c] shadow-[0_18px_34px_rgba(92,122,36,0.2)] ring-1 ring-[#cae474] bg-[#fff9db] -translate-y-0.5'
        : 'bg-[rgba(255,251,234,0.98)] border-[#d9cd88] hover:border-[#a9cb47] hover:shadow-[0_14px_24px_rgba(93,123,39,0.12)] hover:-translate-y-0.5'
        }`}
    >
      <div className="pointer-events-none absolute -left-4 top-8 h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(255,248,208,0.7),transparent_70%)]" />
      <div className="pointer-events-none absolute right-2 top-2 h-7 w-7 bg-[linear-gradient(180deg,rgba(183,218,82,0.46),rgba(109,150,42,0.2))] opacity-90 [clip-path:polygon(50%_0%,66%_12%,86%_14%,100%_34%,88%_52%,100%_70%,86%_86%,66%_88%,50%_100%,34%_88%,14%_86%,0%_70%,12%_52%,0%_34%,14%_14%,34%_12%)]" />
      {/* 選択時のインジケーターライン */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${isSelected ? 'bg-[#89bf34]' : 'bg-transparent'}`} />

      {/* アイコン/写真部分 */}
      <div className={`relative w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-[20px] md:rounded-[22px] flex items-center justify-center text-2xl shadow-[inset_0_2px_12px_rgba(108,136,41,0.12)] border overflow-hidden ${isSelected ? 'bg-[#eef7c4] border-[#b8d95c]' : 'bg-[#f8f1c7] border-[#dfd38e]'}`}>
        {photoUrl ? (
          <Image src={photoUrl} alt={cafe.name} width={64} height={64} unoptimized className="w-full h-full object-cover" />
        ) : (
          <span>☕️</span>
        )}
        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#fff4c6] bg-[linear-gradient(180deg,#ffe88d_0%,#efc94d_100%)] shadow-[0_4px_10px_rgba(214,181,70,0.26)]">
          <span className="block h-2 w-2 rounded-full bg-[#5a7d22]" />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="mb-1 flex items-center gap-1.5 md:hidden">
              <span className={`inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-extrabold ${isSelected ? 'bg-[#e4f3ba] text-[#537320]' : 'bg-[#fff4c9] text-[#7b7f41]'}`}>
                {isSelected ? '本命' : 'きになる'}
              </span>
            </div>
            <h3 className="font-extrabold text-[#284117] text-[13px] md:text-sm line-clamp-2 md:line-clamp-1 leading-[1.22] pr-1">{cafe.name}</h3>
            {/* 評価と営業時間バッジ */}
            <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
              {cafe.rating && (
                <div className="flex items-center gap-1 rounded-full bg-[#fff4cb] px-2 py-[3px] text-[11px] font-bold font-display text-[#d08f18]">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  {cafe.rating.toFixed(1)} <span className="text-[10px] text-[#8b9369] font-medium">({cafe.userRatingCount})</span>
                </div>
              )}
              {cafe.openNow !== undefined && (
                <span className={`text-[10px] px-2 py-[5px] rounded-full font-extrabold ${cafe.openNow ? 'bg-[#dff5b5] text-[#45631e]' : 'bg-[#f1ebc9] text-[#7e845d]'}`}>
                  {cafe.openNow ? '営業中' : '営業時間外'}
                </span>
              )}
            </div>
          </div>

          {/* ボタン群 (シェア・保存) */}
          <div className="flex items-center -mt-1 -mr-1 shrink-0">
            <button
              onClick={handleShare}
              aria-label="シェアする"
              className="hidden md:flex p-2 rounded-2xl text-[#94a168] hover:text-[#496820] hover:bg-[#eef8c9] transition-all lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ShareIcon />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onToggleSave(); }}
              aria-label={isSaved ? '保存を解除' : '保存する'}
              className={`p-2 rounded-full border transition-all ${isSaved
                ? 'border-[#f7d2bb] bg-[#fff0da] text-[#df6a45]'
                : 'border-[#e3d79a] bg-[#fff8df] text-[#94a168] hover:text-[#df6a45] hover:bg-[#fff7dd]'
                }`}
            >
              <HeartIcon filled={isSaved} />
            </button>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-1">
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="hidden md:flex items-center gap-1 text-[11px] text-[#667931] hover:text-[#2e4718] transition-colors w-fit"
          >
            <LocationIcon className="w-3.5 h-3.5 shrink-0 text-[#8eb147]" />
            <span className="truncate hover:underline max-w-[200px]">{cafe.address}</span>
          </a>

          {domain && (
            <a
              href={cafe.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-[#6b8726] hover:text-[#31491b] transition-colors w-fit"
            >
              <LinkIcon />
              <span className="hover:underline line-clamp-1">{domain}</span>
            </a>
          )}
          <p className="md:hidden text-[11px] text-[#7d8756] line-clamp-1 pr-6">{cafe.address}</p>
        </div>
      </div>
    </div>
  );
}

function SelectedCafePanel({ cafe, isSaved, onToggleSave, onClose }: {
  cafe: Cafe;
  isSaved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}) {
  const mapUrl = getCafeMapUrl(cafe);
  const domain = getCafeDomain(cafe);
  const photoUrl = getCafePhotoUrl(cafe);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: cafe.name,
          url: mapUrl,
        });
      } catch { }
      return;
    }

    await navigator.clipboard.writeText(mapUrl);
    alert('マップURLをコピーしました！');
  };

  return (
    <section className="relative rounded-[28px] md:rounded-[30px] bg-[linear-gradient(180deg,#678f28_0%,#3b571a_100%)] text-[#fff9df] p-4 md:p-4 shadow-[0_24px_44px_rgba(70,99,28,0.28)] overflow-hidden border border-[#87b53a]">
      <div className="pointer-events-none absolute right-[-1.8rem] top-[-1.8rem] h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(246,222,105,0.62),rgba(183,218,82,0.18)_55%,transparent_72%)]" />
      <div className="pointer-events-none absolute left-6 top-0 h-8 w-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
      <div className="pointer-events-none absolute bottom-3 right-4 h-10 w-10 bg-[linear-gradient(180deg,rgba(255,243,186,0.18),rgba(255,243,186,0.02))] [clip-path:polygon(50%_0%,65%_12%,84%_16%,100%_36%,87%_54%,100%_73%,84%_87%,65%_89%,50%_100%,35%_89%,16%_87%,0%_73%,13%_54%,0%_36%,16%_16%,35%_12%)]" />
      <div className="flex items-start gap-3 md:gap-4">
        <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-[22px] md:rounded-3xl overflow-hidden border border-[#cde373]/60 bg-[#243515] shadow-[inset_0_2px_12px_rgba(0,0,0,0.18)]">
          {photoUrl ? (
            <Image src={photoUrl} alt={cafe.name} width={96} height={96} unoptimized className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">☕️</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#fff3b8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4d6b22] font-display">
              Durian Pick
            </span>
            <span className="inline-flex items-center rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold text-[#eff7c9]">
              いま気になる
            </span>
          </div>
          <h2 className="mt-1 text-lg md:text-xl font-extrabold leading-tight text-[#fffbe8]">{cafe.name}</h2>

          <div className="flex flex-wrap items-center gap-2 mt-2.5 md:mt-3">
            {cafe.rating && (
              <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold font-display text-[#f7dc73]">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {cafe.rating.toFixed(1)}
                <span className="text-xs text-[#d6dfb6] font-medium">({cafe.userRatingCount})</span>
              </div>
            )}
            {cafe.openNow !== undefined && (
              <span className={`text-[11px] px-2 py-1 rounded-full font-extrabold ${cafe.openNow ? 'bg-[#dff5b5] text-[#45631e]' : 'bg-white/10 text-[#edf2d9]'}`}>
                {cafe.openNow ? '営業中' : '営業時間外'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onClose}
            aria-label="選択を解除"
            className="p-2 md:p-2.5 rounded-2xl bg-[#f8efbd]/12 text-[#fffbe8] hover:bg-[#f8efbd]/18 transition-colors border border-white/10"
          >
            <CloseIcon />
          </button>
          <button
            onClick={handleShare}
            aria-label="シェアする"
            className="p-2 md:p-2.5 rounded-2xl bg-[#f8efbd]/12 text-[#fffbe8] hover:bg-[#f8efbd]/18 transition-colors border border-white/10"
          >
            <ShareIcon />
          </button>
          <button
            onClick={onToggleSave}
            aria-label={isSaved ? '保存を解除' : '保存する'}
            className={`p-2 md:p-2.5 rounded-2xl transition-colors border border-white/10 ${isSaved ? 'bg-[#fff0da]/18 text-[#ffd29e]' : 'bg-[#f8efbd]/12 text-[#fffbe8] hover:bg-[#f8efbd]/18'}`}
          >
            <HeartIcon filled={isSaved} />
          </button>
        </div>
      </div>

      <div className="mt-3 md:mt-4 flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-[22px] bg-white/8 px-3 py-2.5 text-sm text-[#edf2d9]">
          <LocationIcon className="w-4 h-4 shrink-0 mt-0.5 text-[#f7dc73]" />
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="leading-relaxed hover:text-white transition-colors line-clamp-2"
          >
            {cafe.address}
          </a>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,#f7dc73_0%,#ebb940_100%)] px-4 py-2.5 text-sm font-extrabold text-[#42330f] hover:brightness-[1.03] transition-colors border border-[#b98c24] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
          >
            <LocationIcon className="w-4 h-4" />
            地図でみる
          </a>

          {domain && cafe.websiteUri && (
            <a
              href={cafe.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#b6d55d] bg-white/8 px-4 py-2.5 text-sm font-bold text-[#eff7c9] hover:bg-white/12 transition-colors"
            >
              <LinkIcon />
              {domain}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function MapSelectionCard({ cafe, onClose }: { cafe: Cafe; onClose: () => void }) {
  const mapUrl = getCafeMapUrl(cafe);
  const domain = getCafeDomain(cafe);
  const photoUrl = getCafePhotoUrl(cafe);

  return (
    <section className="rounded-[24px] bg-[rgba(255,251,234,0.96)] p-3 shadow-[0_18px_36px_rgba(83,110,29,0.2)] border border-[#d9cd88] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[20px] bg-[#f8f1c7] border border-[#d7cb88]">
          {photoUrl ? (
            <Image src={photoUrl} alt={cafe.name} width={56} height={56} unoptimized className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl">☕️</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1">
                <span className="inline-flex items-center rounded-full bg-[#eef7c8] px-2 py-[3px] text-[10px] font-bold text-[#54711f] font-display">
                  Pin Pick
                </span>
              </div>
              <h3 className="mt-1 text-sm font-extrabold text-[#284117] line-clamp-1">{cafe.name}</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="選択を解除"
              className="rounded-2xl p-2 text-[#7f9154] hover:bg-[#eef8c9] hover:text-[#496820] transition-colors"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {cafe.rating && (
              <span className="inline-flex items-center gap-1 text-xs font-bold font-display text-[#d08f18]">
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {cafe.rating.toFixed(1)}
              </span>
            )}
            {cafe.openNow !== undefined && (
              <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${cafe.openNow ? 'bg-[#dff5b5] text-[#45631e]' : 'bg-[#f1ebc9] text-[#7e845d]'}`}>
                {cafe.openNow ? '営業中' : '営業時間外'}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,#9cd145_0%,#6a9329_100%)] px-3 py-2 text-xs font-extrabold text-[#fff9df] hover:brightness-[1.03] transition-colors border border-[#628629] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
            >
              <LocationIcon className="w-3.5 h-3.5" />
              みにいく
            </a>
            {domain && cafe.websiteUri && (
              <a
                href={cafe.websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#d7cb88] bg-[#fff8dc] px-3 py-2 text-xs font-bold text-[#5f7726] hover:bg-[#fffbee] transition-colors"
              >
                <LinkIcon />
                <span className="truncate max-w-32">{domain}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// --- 小コンポーネント ---
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 md:px-5 py-1.5 md:py-2 rounded-full text-sm font-extrabold border transition-all ${active
        ? 'border-[#5e8128] bg-[linear-gradient(180deg,#98cf42_0%,#678f28_100%)] text-[#fff9df] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_20px_rgba(93,123,39,0.22)]'
        : 'border-[#d7cb88] bg-[#fff8db] text-[#61772b] hover:text-[#284117] hover:bg-[#fffdf0] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
        }`}
    >
      {children}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin -ml-1 mr-1" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function LocationIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-5 h-5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
