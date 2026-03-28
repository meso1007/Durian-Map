"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

// SSR無効でMapViewを読み込む（Leafletはブラウザ専用ではないが、Google Mapsと合わせて一応）
const MapView = dynamic(() => import('./components/MapView'), { ssr: false });

// --- データ取得 ---
const fetchCafes = async (area: string) => {
  try {
    const response = await fetch(
      `/api/search?area=${encodeURIComponent(area)}&category=カフェ`
    );
    if (!response.ok) throw new Error('API request failed');
    const data = await response.json();
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
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedCafes, setSavedCafes] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // モバイル用ボトムシートの状態
  const [sheetState, setSheetState] = useState<'half' | 'full'>('half');
  const touchStartY = useRef(0);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('saved_cafes');
    if (stored) setSavedCafes(JSON.parse(stored));
  }, []);

  // カード選択時: マップがフォーカスし、リスト内でスクロール
  const handleSelectCafe = useCallback((id: string) => {
    setSelectedId(id);
    setTimeout(() => {
      listRef.current?.querySelector(`[data-id="${id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, []);

  // エラートーストの自動非表示
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  const search = async (searchArea: string) => {
    if (!searchArea) return;
    setIsLoading(true);
    setResults([]);
    setSelectedId(null);
    setHasSearched(true);
    setSheetState('half'); // 検索開始時にハーフに戻す
    const { data, error } = await fetchCafes(searchArea);
    if (error) setErrorMsg(error);
    setResults(data);
    setIsLoading(false);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setErrorMsg('お使いのブラウザは位置情報取得に対応していません。');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const areaName = await getAreaFromCoords(pos.coords.latitude, pos.coords.longitude);
          if (!areaName) throw new Error('Area not found');
          setArea(areaName);
          setIsLocating(false);
          search(areaName);
        } catch {
          setIsLocating(false);
          setErrorMsg('現在地のエリア名を取得できませんでした。');
        }
      },
      (err) => {
        setIsLocating(false);
        setErrorMsg('現在地を取得できませんでした。端末とブラウザの位置情報権限をご確認ください。');
      },
      { timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(area);
  };

  const toggleSave = (cafe: any) => {
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

  // 定番エリアのオートコンプリート用リスト
  const popularAreas = ['渋谷', '新宿', '池袋', '東京', '銀座', '横浜', '鎌倉', '大阪', '京都', '福岡', '札幌', '名古屋'];

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[#FAF8F5] relative">

      {/* エラートースト通知 */}
      <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 transition-all duration-400 pointer-events-none w-[90%] md:w-auto flex justify-center ${errorMsg ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
        <div className="bg-stone-900/95 backdrop-blur text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-3">
          <span className="text-rose-400">⚠️</span>
          {errorMsg}
        </div>
      </div>

      {/* ヘッダー (常に上部固定) */}
      <header className="absolute top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-stone-200/60 z-20 flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          {/* 追加されたロゴ画像 */}
          <img src="/logo.png" alt="Durian Map Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-stone-900 tracking-tight text-lg">Durian Map</span>
            <span className="text-[10px] text-amber-600 font-medium px-2 py-0.5 rounded-sm bg-amber-100/50 hidden sm:inline-block">NO CHAINS</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TabButton active={activeTab === 'search'} onClick={() => { setActiveTab('search'); setSheetState('half'); }}>
            探す
          </TabButton>
          <TabButton active={activeTab === 'saved'} onClick={() => { setActiveTab('saved'); setSheetState('half'); }}>
            保存
            {savedCafes.length > 0 && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-px rounded-full font-bold ${activeTab === 'saved' ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-500'
                }`}>
                {savedCafes.length}
              </span>
            )}
          </TabButton>
        </div>
      </header>

      {/* ベース用コンテナ (PCはフレックス、モバイルは重ね合わせ) */}
      <div className="flex-1 w-full flex md:flex-row mt-14 overflow-hidden relative">

        {/* マップ (モバイルでは背景、PCでは右側) */}
        <div className="absolute inset-0 z-0 md:static md:flex-1">
          <MapView
            cafes={currentCafes}
            selectedId={selectedId}
            onSelectCafe={handleSelectCafe}
          />
        </div>

        {/* リストパネル (PC: 左側固定, モバイル: ボトムシート) */}
        <div
          className={`absolute inset-x-0 bottom-0 z-10 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-3xl flex flex-col transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]
            md:static md:w-[400px] md:h-full md:rounded-none md:shadow-none md:border-r md:border-stone-200 md:bg-white/95 md:backdrop-blur-md md:z-auto
            ${sheetState === 'full' ? 'h-[85vh]' : 'h-[45vh]'}`}
        >
          {/* ドラッグハンドル (モバイル専用) */}
          <div
            className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing md:hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={() => setSheetState(s => s === 'half' ? 'full' : 'half')}
          >
            <div className="w-12 h-1.5 rounded-full bg-stone-300 pointer-events-none" />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden px-4 md:px-5">
            {/* 探すタブ: 検索フォーム */}
            {activeTab === 'search' && (
              <div className="shrink-0 pt-2 pb-4 border-b border-stone-100 md:pt-5">
                <button
                  onClick={handleLocate}
                  disabled={isLocating}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition-colors mb-3 disabled:opacity-50 shadow-sm"
                >
                  {isLocating ? <><LoadingSpinner />現在地を取得中...</> : <><LocationIcon />現在地周辺で探す</>}
                </button>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    list="popular-areas"
                    placeholder="エリアを入力（例：渋谷、鎌倉）"
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 focus:bg-white transition-all shadow-inner"
                  />
                  <datalist id="popular-areas">
                    {popularAreas.map(a => <option key={a} value={a} />)}
                  </datalist>
                  <button
                    type="submit"
                    disabled={isLoading || !area}
                    className="px-5 py-2.5 rounded-2xl bg-amber-400 text-amber-950 text-sm font-semibold hover:bg-amber-300 transition-colors disabled:opacity-40 shadow-sm"
                  >
                    検索
                  </button>
                </form>
              </div>
            )}

            {/* お気に入りタブ: タイトル */}
            {activeTab === 'saved' && (
              <div className="shrink-0 py-4 md:pt-6 border-b border-stone-100">
                <h2 className="font-bold text-lg text-stone-900">保存したカフェ</h2>
              </div>
            )}

            {/* カフェリスト (スクロール領域) */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-4 flex flex-col gap-3 scroll-smooth pb-10">

              {/* ローディング */}
              {isLoading && (
                <div className="flex flex-col gap-3 animate-pulse">
                  {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-stone-100" />)}
                </div>
              )}

              {/* 結果 */}
              {!isLoading && currentCafes.length > 0 && (
                <>
                  {activeTab === 'search' && (
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-stone-500">{results.length}件見つかりました</p>
                    </div>
                  )}
                  {currentCafes.map(cafe => (
                    <CafeCard
                      key={cafe.id}
                      cafe={cafe}
                      isSelected={cafe.id === selectedId}
                      isSaved={savedCafes.some(c => c.id === cafe.id)}
                      onSelect={() => handleSelectCafe(cafe.id)}
                      onToggleSave={() => toggleSave(cafe)}
                    />
                  ))}
                </>
              )}

              {/* 空状態 */}
              {!isLoading && currentCafes.length === 0 && (activeTab === 'saved' || hasSearched) && (
                <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4 text-3xl shadow-inner border border-stone-200/50">
                    ☕️
                  </div>
                  <p className="text-sm font-medium">
                    {activeTab === 'saved' ? 'まだ保存したカフェはありません' : '見つかりませんでした'}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
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
  cafe: any;
  isSelected: boolean;
  isSaved: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
};

function CafeCard({ cafe, isSelected, isSaved, onSelect, onToggleSave }: CafeCardProps) {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name)}&query_place_id=${cafe.id}`;

  const domain = (() => {
    try { return new URL(cafe.websiteUri).hostname.replace('www.', ''); } catch { return null; }
  })();

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const photoUrl = cafe.photoName && apiKey
    ? `https://places.googleapis.com/v1/${cafe.photoName}/media?maxHeightPx=200&maxWidthPx=200&key=${apiKey}`
    : null;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: cafe.name,
          url: mapUrl
        });
      } catch (err) { }
    } else {
      navigator.clipboard.writeText(mapUrl);
      alert('マップURLをコピーしました！');
    }
  };

  return (
    <div
      data-id={cafe.id}
      onClick={onSelect}
      className={`bg-white rounded-2xl p-4 flex gap-4 cursor-pointer transition-all duration-300 group border relative overflow-hidden shrink-0 ${isSelected
        ? 'border-amber-400 shadow-[0_4px_20px_rgba(251,191,36,0.25)] ring-1 ring-amber-400 bg-amber-50/10'
        : 'border-stone-100 hover:border-stone-300 hover:shadow-md hover:-translate-y-0.5'
        }`}
    >
      {/* 選択時のインジケーターライン */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${isSelected ? 'bg-amber-400' : 'bg-transparent'}`} />

      {/* アイコン/写真部分 */}
      <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center text-2xl shadow-inner border overflow-hidden ${isSelected ? 'bg-amber-100/50 border-amber-200' : 'bg-stone-50 border-stone-100'}`}>
        {photoUrl ? (
          <img src={photoUrl} alt={cafe.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span>☕️</span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-start justify-between gap-1 mb-1">
          <div>
            <h3 className="font-bold text-stone-900 text-sm line-clamp-1 leading-tight pr-1">{cafe.name}</h3>
            {/* 評価と営業時間バッジ */}
            <div className="flex items-center gap-2 mt-1">
              {cafe.rating && (
                <div className="flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  {cafe.rating.toFixed(1)} <span className="text-[10px] text-stone-400 font-normal">({cafe.userRatingCount})</span>
                </div>
              )}
              {cafe.openNow !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${cafe.openNow ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                  {cafe.openNow ? '営業中' : '営業時間外'}
                </span>
              )}
            </div>
          </div>

          {/* ボタン群 (シェア・保存) */}
          <div className="flex items-center -mt-2 -mr-2 shrink-0">
            <button
              onClick={handleShare}
              aria-label="シェアする"
              className="p-2 rounded-xl text-stone-300 hover:text-stone-500 hover:bg-stone-50 transition-all lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ShareIcon />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onToggleSave(); }}
              aria-label={isSaved ? '保存を解除' : '保存する'}
              className={`p-2 rounded-xl transition-all ${isSaved
                ? 'text-rose-500 hover:bg-rose-50'
                : 'text-stone-300 hover:text-rose-400 hover:bg-stone-50 lg:opacity-0 lg:group-hover:opacity-100'
                }`}
            >
              <HeartIcon filled={isSaved} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1 mt-auto">
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 transition-colors w-fit"
          >
            <LocationIcon className="w-3.5 h-3.5 shrink-0 text-stone-400" />
            <span className="truncate hover:underline max-w-[200px]">{cafe.address}</span>
          </a>

          {domain && (
            <a
              href={cafe.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 transition-colors w-fit"
            >
              <LinkIcon />
              <span className="hover:underline">{domain}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// --- 小コンポーネント ---
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${active ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
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
