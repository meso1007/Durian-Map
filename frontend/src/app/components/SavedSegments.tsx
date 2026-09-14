'use client';

import type { SavedFilter } from '@/hooks/useCafeFilters';

/** 保存タブのセグメンテッドコントロール（.pen の Filter Segmented）。 */
export default function SavedSegments({
  value,
  onChange,
  counts,
}: {
  value: SavedFilter;
  onChange: (next: SavedFilter) => void;
  counts: { all: number; want: number; visited: number };
}) {
  const segments = [
    { id: 'all', label: 'すべて', count: counts.all },
    { id: 'want', label: '行きたい', count: counts.want },
    { id: 'visited', label: '訪問済み', count: counts.visited },
  ] as const;

  return (
    <div className="flex min-w-0 overflow-hidden rounded-full border border-border bg-surface divide-x divide-border">
      {segments.map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap ${value === id ? 'bg-primary text-white' : 'text-text-muted'}`}
        >
          {label}
          <span className="num ml-1 font-normal opacity-80">{count}</span>
        </button>
      ))}
    </div>
  );
}
