'use client';

import { useState } from 'react';

import { ArrowRightIcon, ChevronRightIcon, LoadingSpinner, TargetIcon } from './icons';

/** 定番エリアのオートコンプリート用リスト。 */
const POPULAR_AREAS = ['渋谷', '新宿', '池袋', '東京', '銀座', '横浜', '鎌倉', '大阪', '京都', '福岡', '札幌', '名古屋'];

type Props = {
  /** 検索が済んだら CTA を畳み、地図とリストに高さを返す。 */
  compact: boolean;
  isLocating: boolean;
  isSearching: boolean;
  /** URL から復元したエリア名。ユーザーが入力を始めたら上書きしない。 */
  initialArea: string;
  onLocate: () => void;
  onSearch: (area: string) => void;
};

/**
 * 検索フォーム。
 *
 * 入力中の文字列はここに閉じ込める。親に持たせると 1 文字ごとに地図と
 * カード 20 枚が再描画される。
 */
export default function SearchPanel({ compact, isLocating, isSearching, initialArea, onLocate, onSearch }: Props) {
  const [area, setArea] = useState(initialArea);

  // URL からの復元（リロード・共有リンク）を入力欄に反映する。
  // 以降はユーザーの入力が正なので、initialArea が変わったときだけ追従する。
  // 描画中に調整するのが React の推奨（effect にすると 1 フレーム古い値が見える）。
  const [syncedArea, setSyncedArea] = useState(initialArea);
  if (initialArea !== syncedArea) {
    setSyncedArea(initialArea);
    setArea(initialArea);
  }

  return (
    <>
      {/* 最重要 CTA: 1 画面 1 つ（docs/design.md 1節）。畳んだ後は検索行のアイコンボタンになる。 */}
      {!compact && (
        <button
          type="button"
          onClick={onLocate}
          disabled={isLocating}
          className="mt-3 w-full min-h-[56px] flex items-center gap-3 px-4 py-3 rounded-xl bg-cta text-text text-left transition-opacity disabled:opacity-50"
        >
          <span className="shrink-0">{isLocating ? <LoadingSpinner /> : <TargetIcon />}</span>
          <span className="flex-1 min-w-0 text-base font-bold leading-tight">
            {isLocating ? '現在地を取得中...' : '近くからさがす'}
          </span>
          <ChevronRightIcon />
        </button>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(area);
        }}
        className="mt-3 flex gap-2"
      >
        {compact && (
          <button
            type="button"
            onClick={onLocate}
            disabled={isLocating}
            aria-label="近くからさがす"
            className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-cta text-text transition-opacity disabled:opacity-50"
          >
            {isLocating ? <LoadingSpinner /> : <TargetIcon />}
          </button>
        )}

        {/*
          text-base（16px）は iOS の自動ズーム対策。これ未満にしないこと（docs/design.md 6節）。
          focus:outline-none はキーボード操作で現在地が分からなくなるので使わない。
        */}
        <input
          type="text"
          value={area}
          onChange={(event) => setArea(event.target.value)}
          list="popular-areas"
          aria-label="検索したいエリア名"
          placeholder="エリア名からさがす"
          className="flex-1 min-w-0 h-12 px-4 rounded-xl bg-surface text-base text-text placeholder-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus:ring-2 focus:ring-lime"
        />
        <datalist id="popular-areas">
          {POPULAR_AREAS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <button
          type="submit"
          disabled={isSearching || !area.trim()}
          aria-label="このエリアで検索"
          className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-primary-deep text-white transition-opacity disabled:opacity-40"
        >
          <ArrowRightIcon />
        </button>
      </form>
    </>
  );
}
