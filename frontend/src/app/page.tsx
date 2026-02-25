"use client";

import React, { useState, useEffect } from 'react';
const fetchRealLeads = async (area: string, category: string) => {
  try {
    // Honoバックエンドのエンドポイントを叩く
    const response = await fetch(`http://localhost:8080/api/search?area=${area}&category=${category}`);

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data.leads || [];
  } catch (error) {
    console.error("Error fetching leads:", error);
    return []; // エラー時は空の配列を返す
  }
};

export default function DorianMapDashboard() {
  // --- 状態管理 (State) ---
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [savedLeads, setSavedLeads] = useState<any[]>([]);

  // --- 初期読み込み（localStorageから保存済みリードを取得） ---
  useEffect(() => {
    const stored = localStorage.getItem('dorian_saved_leads');
    if (stored) setSavedLeads(JSON.parse(stored));
  }, []);

  // --- 検索処理 ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!area || !category) return;

    setIsLoading(true);
    setResults([]); // 検索前に結果をクリア

    // ★ここを書き換え
    const data = await fetchRealLeads(area, category);

    setResults(data);
    setIsLoading(false);
  };

  // --- リード保存処理 ---
  const toggleSaveLead = (lead: any) => {
    const isAlreadySaved = savedLeads.some(l => l.id === lead.id);
    let newSavedLeads;

    if (isAlreadySaved) {
      // 既に保存されていれば削除
      newSavedLeads = savedLeads.filter(l => l.id !== lead.id);
    } else {
      // 保存されていなければ追加
      newSavedLeads = [...savedLeads, lead];
    }

    setSavedLeads(newSavedLeads);
    localStorage.setItem('dorian_saved_leads', JSON.stringify(newSavedLeads)); // ブラウザに保存
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-800 font-sans flex">
      {/* --- サイドバー --- */}
      <aside className="w-64 border-r border-zinc-200 p-6 flex flex-col gap-4 bg-white">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Dorian Map</h1>
        <nav className="flex flex-col gap-2 mt-8">
          <button
            onClick={() => setActiveTab('search')}
            className={`text-left px-3 py-2 rounded-md font-medium transition-colors ${activeTab === 'search' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'}`}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`text-left px-3 py-2 rounded-md font-medium transition-colors flex justify-between items-center ${activeTab === 'saved' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'}`}
          >
            Saved Leads
            {savedLeads.length > 0 && (
              <span className="bg-zinc-800 text-white text-[10px] px-2 py-0.5 rounded-full">{savedLeads.length}</span>
            )}
          </button>
        </nav>
      </aside>

      {/* --- メインコンテンツ --- */}
      <main className="flex-1 p-10 max-w-5xl">

        {/* === 検索タブ === */}
        {activeTab === 'search' && (
          <>
            <header className="mb-8">
              <h2 className="text-2xl font-semibold mb-6">Find Opportunities</h2>

              <form onSubmit={handleSearch} className="flex gap-4">
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Area (e.g., 藤沢市)"
                  className="px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-800 bg-white w-64 shadow-sm"
                  required
                />
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category (e.g., 美容室)"
                  className="px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-800 bg-white w-64 shadow-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </form>
            </header>

            <section className="mt-8">
              {/* ローディングUI (スケルトン) */}
              {isLoading && (
                <div className="flex flex-col gap-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white border border-zinc-100 rounded-xl p-5 h-24"></div>
                  ))}
                </div>
              )}

              {/* 検索結果表示 */}
              {!isLoading && results.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-zinc-500 mb-2">{results.length}件のリードが見つかりました</h3>
                  {results.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isSaved={savedLeads.some(l => l.id === lead.id)}
                      onToggleSave={() => toggleSaveLead(lead)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* === 保存済みタブ === */}
        {activeTab === 'saved' && (
          <section>
            <h2 className="text-2xl font-semibold mb-6">Saved Leads</h2>
            {savedLeads.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center text-zinc-400">
                保存されたリードはまだありません
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {savedLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isSaved={true}
                    onToggleSave={() => toggleSaveLead(lead)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// --- 店舗カードコンポーネント ---
function LeadCard({ lead, isSaved, onToggleSave }: { lead: any, isSaved: boolean, onToggleSave: () => void }) {
  // ★ プレイスIDを利用して、正確に店舗を指し示すGoogle MapsのURLを生成
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name)}&query_place_id=${lead.id}`;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 flex items-center justify-between hover:border-zinc-300 hover:shadow-sm transition-all group">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-semibold text-zinc-800">{lead.name}</h4>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${lead.status === 'No Website'
            ? 'bg-red-50 text-red-600 border border-red-100'
            : 'bg-amber-50 text-amber-600 border border-amber-100'
            }`}>
            {lead.status}
          </span>
        </div>

        {/* ★ 住所部分をリンク化（ウォーム・ミニマルなアイコン付き） */}
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-zinc-400 hover:text-zinc-800 transition-colors flex items-center gap-1.5 w-fit mt-1 group/link"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="group-hover/link:underline">{lead.address}</span>
        </a>

        <p className="text-xs text-zinc-400 mt-1">カテゴリ: {lead.category}</p>
      </div>

      <div>
        <button
          onClick={onToggleSave}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isSaved
            ? 'bg-zinc-800 text-white hover:bg-zinc-700'
            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 opacity-0 group-hover:opacity-100'
            }`}
        >
          {isSaved ? 'Saved' : 'Save Lead'}
        </button>
      </div>
    </div>
  );
}