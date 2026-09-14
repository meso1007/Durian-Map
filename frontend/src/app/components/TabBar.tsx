'use client';

import { BookmarkIcon, MapIcon } from './icons';

export type TabId = 'search' | 'saved';

const TABS: { id: TabId; label: string }[] = [
  { id: 'search', label: 'さがす' },
  { id: 'saved', label: '保存' },
];

/**
 * 下部タブバー（.pen の Tab Bar）。
 * .pen は 4 タブだが、履歴・マイページは機能が無いので作らない
 * （docs/design.md「押せるのに効かない UI は作らない」）。
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
  return (
    <nav
      className="shrink-0 z-40 flex border-t border-border bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="メインナビゲーション"
    >
      {TABS.map(({ id, label }) => {
        const isActive = id === active;
        const badge = id === 'saved' && savedCount > 0 ? savedCount : undefined;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 pt-1.5 pb-2 ${isActive ? 'text-primary' : 'text-text-muted'}`}
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
    </nav>
  );
}
