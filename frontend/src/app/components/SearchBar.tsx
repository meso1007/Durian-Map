'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import BrandMark from './BrandMark';
import { CloseIcon, HistoryIcon, LoadingSpinner, LocationIcon, SearchIcon, TargetIcon } from './icons';

/** 入力候補に出す定番エリア。個人経営のカフェが集まる街を中心に選んである。 */
export const POPULAR_AREAS = ['中目黒', '蔵前', '清澄白河', '谷中', '下北沢', '吉祥寺', '鎌倉', '京都'];

const MAX_SUGGESTIONS = 6;

type Props = {
  /** URL から復元したエリア名、または直近に検索したエリア名。 */
  area: string;
  recentAreas: readonly string[];
  isLocating: boolean;
  isSearching: boolean;
  /** 現在地ボタンを出すか。初回表示では本体側の CTA が同じ役を持つので出さない。 */
  showLocate: boolean;
  /** 現在地ボタンをマンゴーで出すか。詳細や保存の一覧では主役ではないので、控えめな面にする。 */
  emphasizeLocate: boolean;
  onLocate: () => void;
  onSearch: (area: string) => void;
};

/**
 * 検索バー。地図の上に浮く（モバイルは上端、PC は左上）。
 *
 * 入力中の文字列はここに閉じ込める。親に持たせると 1 文字ごとに地図と
 * カード 20 枚が再描画される。
 */
export default function SearchBar({
  area,
  recentAreas,
  isLocating,
  isSearching,
  showLocate,
  emphasizeLocate,
  onLocate,
  onSearch,
}: Props) {
  const [value, setValue] = useState(area);

  // 外から決まったエリア（URL の復元・チップからの検索）を入力欄に反映する。
  // 描画中に調整するのが React の推奨（effect にすると 1 フレーム古い値が見える）。
  const [syncedArea, setSyncedArea] = useState(area);
  if (area !== syncedArea) {
    setSyncedArea(area);
    setValue(area);
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();

  // 候補: 最近の検索を先に、定番エリアを後に。入力があればそれを含むものだけ残す。
  const suggestions = useMemo(() => {
    const query = value.trim();
    const recent = recentAreas.map((name) => ({ name, recent: true }));
    const popular = POPULAR_AREAS.filter((name) => !recentAreas.includes(name)).map((name) => ({ name, recent: false }));

    return [...recent, ...popular]
      .filter(({ name }) => (query ? name.includes(query) && name !== query : true))
      .slice(0, MAX_SUGGESTIONS);
  }, [value, recentAreas]);

  const showSuggestions = open && suggestions.length > 0;
  const isDirty = value.trim() !== '' && value.trim() !== area;

  // 「/」で検索欄へ。入力中の欄があるときは奪わない。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = (next: string) => {
    const name = next.trim();
    if (!name) return;

    setValue(name);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
    onSearch(name);
  };

  return (
    <div className="pointer-events-auto absolute inset-x-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-30 animate-pop md:static md:rounded-t-3xl md:bg-primary-deepest md:p-4 md:shadow-float">
      {/*
        ブランドロックアップ（PC）。マークがワードマークの "D" を兼ねるので、
        表示テキストは "urian Map"、読み上げは aria-label で "Durian Map" にする。
        モバイルでは検索欄の左のマークがその役を持つ（h1 は Welcome 側に置かない: 1 画面 1 つ）。
      */}
      <h1 className="sr-only md:not-sr-only md:mb-3 md:flex md:items-center" aria-label="Durian Map">
        <BrandMark tone="dark" className="hidden h-11 w-11 shrink-0 md:block" />
        <span aria-hidden className="hidden font-display text-[26px] font-bold leading-none text-cream md:-ml-1 md:block">
          urian Map
        </span>
        <span aria-hidden className="ml-auto hidden text-xs font-medium text-cream/80 md:block">
          チェーンじゃない、あの一杯へ。
        </span>
      </h1>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit(activeIndex >= 0 && showSuggestions ? suggestions[activeIndex].name : value);
        }}
        className="relative flex h-14 items-center gap-1 rounded-2xl bg-surface pl-2 pr-2 shadow-float outline-offset-2 outline-primary has-[input:focus-visible]:outline-2 md:shadow-none md:outline-lime"
      >
        <BrandMark className="h-9 w-9 shrink-0 md:hidden" />
        <SearchIcon className="ml-2 hidden h-5 w-5 shrink-0 text-text-muted md:block" />

        {/* text-base（16px）は iOS の自動ズーム対策。これ未満にしないこと（docs/design.md 6節）。 */}
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              if (showSuggestions) event.stopPropagation();
              setOpen(false);
              setActiveIndex(-1);
            } else if (event.key === 'ArrowDown' && suggestions.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index + 1) % suggestions.length);
            } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
            }
          }}
          role="combobox"
          aria-label="エリア・駅名でさがす"
          aria-expanded={showSuggestions}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showSuggestions && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          placeholder="エリア・駅名でさがす"
          className="h-full min-w-0 flex-1 rounded-xl bg-transparent px-2 text-base text-text placeholder:text-text-muted focus-visible:outline-none"
        />

        {value && (
          <button
            type="button"
            aria-label="入力を消す"
            onClick={() => {
              setValue('');
              inputRef.current?.focus();
            }}
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:text-text"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}

        {/* 検索ボタンは、いまの検索と違う文字が入っているときだけ出す（キーボードの「検索」でも送れる）。 */}
        {isDirty && (
          <button
            type="submit"
            aria-label="このエリアでさがす"
            className="flex h-11 w-11 shrink-0 animate-fade items-center justify-center rounded-xl bg-primary-deepest text-cream transition-transform duration-[var(--dm-duration-fast)] active:scale-95"
          >
            <SearchIcon />
          </button>
        )}

        {showLocate && (
          <button
            type="button"
            onClick={onLocate}
            disabled={isLocating}
            aria-label={isLocating ? '現在地を取得中' : '近くからさがす'}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text transition-[transform,background-color] duration-[var(--dm-duration-fast)] active:scale-95 disabled:opacity-60 ${emphasizeLocate ? 'bg-cta' : 'bg-surface-sunken'}`}
          >
            {isLocating ? <LoadingSpinner className="h-5 w-5" /> : <TargetIcon className="h-5 w-5" />}
          </button>
        )}

        {/* 検索中の進行バー。入力欄の下端を左から右へ抜ける。 */}
        {isSearching && (
          <span aria-hidden className="pointer-events-none absolute inset-x-4 bottom-0 h-0.5 overflow-hidden rounded-full">
            <span className="block h-full w-2/5 animate-progress rounded-full bg-lime" />
          </span>
        )}

        {/*
          候補は常に DOM に置き、開いているときだけ見せる（aria-controls の参照先を消さないため）。
          mousedown を止めているのは、候補を押した瞬間に入力欄の blur が先に走って閉じてしまうのを防ぐため。
        */}
        <ul
          id={listId}
          role="listbox"
          aria-label="エリアの候補"
          hidden={!showSuggestions}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 animate-pop overflow-hidden rounded-2xl bg-surface p-1.5 shadow-float"
        >
          {suggestions.map(({ name, recent }, index) => (
            <li
              key={name}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => submit(name)}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] text-text ${index === activeIndex ? 'bg-surface-sunken' : 'hover:bg-surface-sunken'}`}
            >
              <span className="text-text-muted">{recent ? <HistoryIcon /> : <LocationIcon />}</span>
              {name}
              {recent && <span className="ml-auto text-xs text-text-muted">最近の検索</span>}
            </li>
          ))}
        </ul>
      </form>
    </div>
  );
}
