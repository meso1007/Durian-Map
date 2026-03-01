"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

// SSR無効でMapViewを読み込む（Leafletはブラウザ専用）
const MapView = dynamic(() => import('./components/MapView'), { ssr: false });

// --- データ取得 ---
const fetchCafes = async (area: string) => {
  try {
    const response = await fetch(
      `http://localhost:8080/api/search?area=${encodeURIComponent(area)}&category=カフェ`
    );
    if (!response.ok) throw new Error('API request failed');
    const data = await response.json();
    return data.leads || [];
  } catch (error) {
    console.error('Error fetching cafes:', error);
    return [];
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

  const search = async (searchArea: string) => {
    if (!searchArea) return;
    setIsLoading(true);
    setResults([]);
    setSelectedId(null);
    setHasSearched(true);
    const data = await fetchCafes(searchArea);
    setResults(data);
    setIsLoading(false);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const areaName = await getAreaFromCoords(pos.coords.latitude, pos.coords.longitude);
          setArea(areaName);
          setIsLocating(false);
          if (areaName) search(areaName);
        } catch {
          setIsLocating(false);
        }
      },
      () => setIsLocating(false)
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

  const currentCafes = activeTab === 'search' ? results : savedCafes;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FAF8F5]">

      {/* ヘッダー */}
      <header className="shrink-0 bg-[#FAF8F5]/90 backdrop-blur-sm border-b border-stone-200/60 z-20">
        <div className="px-5 py-3 flex items-center justify-between">
          <div>
            <span className="font-semibold text-stone-900 tracking-tight">Durian Map</span>
            <span className="ml-2 text-xs text-stone-400">チェーン店なし</span>
          </div>
          <div className="flex items-center gap-1">
            <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')}>
              探す
            </TabButton>
            <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>
              お気に入り
              {savedCafes.length > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-px rounded-full font-medium ${
                  activeTab === 'saved' ? 'bg-white/20' : 'bg-stone-200 text-stone-500'
                }`}>
                  {savedCafes.length}
                </span>
              )}
            </TabButton>
          </div>
        </div>
      </header>

      {/* コンテンツ: モバイル=縦積み / PC=横並び */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* マップ: モバイルは上 / PCは右 */}
        <div className="h-[45vh] shrink-0 md:h-auto md:flex-1 md:order-last">
          <MapView
            cafes={currentCafes}
            selectedId={selectedId}
            onSelectCafe={handleSelectCafe}
          />
        </div>

        {/* リストパネル: モバイルは下 / PCは左 */}
        <div className="flex-1 flex flex-col overflow-hidden md:flex-none md:w-96 md:order-first md:border-r md:border-stone-200">

          {/* 探すタブ: 検索フォーム */}
          {activeTab === 'search' && (
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-stone-100">
              <button
                onClick={handleLocate}
                disabled={isLocating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors mb-2 disabled:opacity-50"
              >
                {isLocating ? <><LoadingSpinner />現在地を取得中...</> : <><LocationIcon />現在地で探す</>}
              </button>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="エリアを入力（例：渋谷、鎌倉）"
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <button
                  type="submit"
                  disabled={isLoading || !area}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 transition-colors disabled:opacity-40"
                >
                  検索
                </button>
              </form>
            </div>
          )}

          {/* お気に入りタブ: タイトル */}
          {activeTab === 'saved' && (
            <div className="shrink-0 px-5 py-4 border-b border-stone-100">
              <h2 className="font-semibold text-stone-900">お気に入り</h2>
            </div>
          )}

          {/* カフェリスト */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">

            {/* ローディング */}
            {isLoading && (
              <div className="flex flex-col gap-2 animate-pulse mt-1">
                {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-stone-100" />)}
              </div>
            )}

            {/* 結果 */}
            {!isLoading && currentCafes.length > 0 && (
              <>
                {activeTab === 'search' && (
                  <p className="text-xs text-stone-400 mb-0.5">{results.length}件見つかりました</p>
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
              <div className="flex flex-col items-center justify-center py-16 text-stone-300">
                <p className="text-4xl mb-2">☕</p>
                <p className="text-sm">
                  {activeTab === 'saved' ? 'まだ保存したカフェはありません' : '見つかりませんでした'}
                </p>
              </div>
            )}
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

  return (
    <div
      data-id={cafe.id}
      onClick={onSelect}
      className={`bg-white rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all group border ${
        isSelected ? 'border-stone-400 shadow-md' : 'border-stone-100 hover:border-stone-200 hover:shadow-sm'
      }`}
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-stone-900 text-sm truncate mb-1">{cafe.name}</h3>

        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors w-fit mb-0.5"
        >
          <LocationIcon className="w-3 h-3 shrink-0" />
          <span className="truncate hover:underline">{cafe.address}</span>
        </a>

        {domain && (
          <a
            href={cafe.websiteUri}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors w-fit"
          >
            <LinkIcon />
            <span className="hover:underline">{domain}</span>
          </a>
        )}
      </div>

      {/* ハートボタン */}
      <button
        onClick={e => { e.stopPropagation(); onToggleSave(); }}
        aria-label={isSaved ? '保存を解除' : '保存する'}
        className={`shrink-0 p-1.5 rounded-lg transition-all ${
          isSaved
            ? 'text-rose-400 hover:bg-rose-50'
            : 'text-stone-200 hover:text-stone-400 hover:bg-stone-50 opacity-0 group-hover:opacity-100'
        }`}
      >
        <HeartIcon filled={isSaved} />
      </button>
    </div>
  );
}

// --- 小コンポーネント ---
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'
      }`}
    >
      {children}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
