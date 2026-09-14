'use client';

import type { SavedFilter } from '@/hooks/useCafeFilters';

import { CupIcon } from './icons';
import type { TabId } from './TabBar';

/** 空状態は 3 か所で同じ形なので 1 つにまとめた（docs/design.md 5節: 白紙にしない）。 */
export default function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-sunken flex items-center justify-center mb-4 text-primary">
        <CupIcon className="w-8 h-8" />
      </div>
      <p className="text-base font-bold text-text">{title}</p>
      <p className="text-sm text-text-muted mt-2 leading-[1.6]">{description}</p>
    </div>
  );
}

/** 状況ごとの文言。「見つかりませんでした」だけで放り出さない。 */
export function emptyStateCopy({
  tab,
  savedFilter,
  hasSearched,
  activeFilterCount,
}: {
  tab: TabId;
  savedFilter: SavedFilter;
  hasSearched: boolean;
  activeFilterCount: number;
}): { title: string; description: string } {
  if (tab === 'saved') {
    return {
      title:
        savedFilter === 'all'
          ? 'まだ保存したカフェはありません'
          : savedFilter === 'want'
            ? '「行きたい」はまだありません'
            : '「訪問済み」はまだありません',
      description: '気になるカフェを選んで「保存」すると、ここに並びます。',
    };
  }

  if (!hasSearched) {
    return {
      title: 'まずはエリアを決めましょう',
      description: '現在地の周辺で探すか、エリア名を入力してください。',
    };
  }

  if (activeFilterCount > 0) {
    return {
      title: '条件に合うカフェがありません',
      description: '絞り込みを外すと、ほかのカフェが表示されます。',
    };
  }

  return { title: '見つかりませんでした', description: '別のエリア名でお試しください。' };
}
