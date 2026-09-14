'use client';

import { useRef } from 'react';

import { BookmarkIcon, MapIcon } from './icons';

export type TabId = 'search' | 'saved';

const TABS: { id: TabId; label: string }[] = [
  { id: 'search', label: 'さがす' },
  { id: 'saved', label: '保存' },
];

/** タブ 1 つ分の DOM id。tabpanel から aria-labelledby で参照する。 */
export const tabButtonId = (id: TabId) => `tab-${id}`;
export const tabPanelId = 'tab-panel';

/**
 * 下部タブバー（.pen の Tab Bar）。
 * .pen は 4 タブだが、履歴・マイページは機能が無いので作らない
 * （docs/design.md「押せるのに効かない UI は作らない」）。
 *
 * ARIA のタブパターンに従う: 選択中のタブだけがフォーカスを受け、
 * 左右（上下）キーでタブを移動する。
 */
export default function TabBar({
  active,
  onChange,
  savedCount,
}: {
  active: TabId;
  onChange: (next: TabId) => void;
  savedCount: number;
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const moveFocus = (from: number, delta: number) => {
    const next = (from + delta + TABS.length) % TABS.length;
    onChange(TABS[next].id);
    buttonsRef.current[next]?.focus();
  };

  return (
    <nav
      className="shrink-0 z-40 flex border-t border-border bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="メインナビゲーション"
    >
      <div role="tablist" aria-label="表示の切り替え" className="flex w-full">
        {TABS.map(({ id, label }, index) => {
          const isActive = id === active;
          const badge = id === 'saved' && savedCount > 0 ? savedCount : undefined;

          return (
            <button
              key={id}
              ref={(element) => {
                buttonsRef.current[index] = element;
              }}
              type="button"
              role="tab"
              id={tabButtonId(id)}
              aria-selected={isActive}
              aria-controls={tabPanelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveFocus(index, 1);
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveFocus(index, -1);
                }
              }}
              className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 pt-1.5 pb-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${isActive ? 'text-primary' : 'text-text-muted'}`}
            >
              <span className="relative">
                {id === 'search' ? <MapIcon /> : <BookmarkIcon filled={isActive} />}
                {badge != null && (
                  <span className="num absolute -top-1.5 -right-2.5 min-w-[18px] rounded-full bg-accent px-1 text-[10px] font-bold leading-[18px] text-white">
                    {badge}
                  </span>
                )}
              </span>
              <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
