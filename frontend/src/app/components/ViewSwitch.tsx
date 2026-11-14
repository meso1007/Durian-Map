'use client';

import { useRef } from 'react';

export type TabId = 'search' | 'saved';

const TABS: { id: TabId; label: string }[] = [
  { id: 'search', label: 'さがす' },
  { id: 'saved', label: '保存' },
];

/** タブ 1 つ分の DOM id。tabpanel から aria-labelledby で参照する。 */
export const tabButtonId = (id: TabId) => `tab-${id}`;
export const tabPanelId = 'tab-panel';

/**
 * 「さがす / 保存」の切り替え。本体の先頭に置く（下部タブバーは作らない / docs/design.md 4.5節）。
 *
 * ARIA のタブパターンに従う: 選択中のタブだけがフォーカスを受け、左右キーで移動する。
 * 選択を示す濃緑の面は 1 枚で、transform で左右に滑らせる。
 */
export default function ViewSwitch({
  active,
  onChange,
  savedCount,
}: {
  active: TabId;
  onChange: (next: TabId) => void;
  savedCount: number;
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = TABS.findIndex((tab) => tab.id === active);

  const moveFocus = (from: number, delta: number) => {
    const next = (from + delta + TABS.length) % TABS.length;
    onChange(TABS[next].id);
    buttonsRef.current[next]?.focus();
  };

  return (
    <div className="px-4 pb-3 pt-2 md:pt-4">
      <div
        role="tablist"
        aria-label="表示の切り替え"
        className="relative grid grid-cols-2 rounded-full bg-surface-sunken p-1"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary-deepest transition-transform duration-[var(--dm-duration-base)] ease-out"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />

        {TABS.map(({ id, label }, index) => {
          const isActive = id === active;

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
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  moveFocus(index, 1);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  moveFocus(index, -1);
                }
              }}
              className={`relative z-10 flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-bold transition-colors duration-[var(--dm-duration-fast)] ${isActive ? 'text-cream' : 'text-text-muted hover:text-text'}`}
            >
              {label}
              {id === 'saved' && savedCount > 0 && (
                <span
                  className={`num min-w-5 rounded-full px-1.5 text-[11px] leading-5 ${isActive ? 'bg-cream text-primary-deepest' : 'bg-accent-soft text-accent-text'}`}
                >
                  {savedCount}
                  <span className="sr-only">件</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
