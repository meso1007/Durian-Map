'use client';

import type { SavedFilter } from '@/hooks/useCafeFilters';

import BrandMark from './BrandMark';
import type { TabId } from './ViewSwitch';

export type EmptyCopy = {
  title: string;
  description: string;
  /** 次の一手。押せば実際に状況が変わるものだけを置く。 */
  action?: { label: string; onClick: () => void };
};

/** 空状態・エラー。白紙にせず、次に何をすればよいかまで示す（docs/design.md 5節）。 */
export default function EmptyState({ title, description, action }: EmptyCopy) {
  return (
    <div className="flex animate-fade flex-col items-center px-6 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-sunken">
        <BrandMark className="h-12 w-12" />
      </div>
      <p className="mt-5 text-base font-bold text-text">{title}</p>
      <p className="mt-2 max-w-[28ch] text-sm leading-[1.7] text-text-muted">{description}</p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-5 text-sm font-bold text-text transition-colors duration-[var(--dm-duration-fast)] hover:border-primary hover:bg-surface-sunken"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** 状況ごとの文言。「見つかりませんでした」だけで放り出さない。 */
export function emptyStateCopy({
  tab,
  savedFilter,
  activeFilterCount,
  errorMessage,
  onClearFilters,
  onRetry,
  onShowAllSaved,
  onGoSearch,
}: {
  tab: TabId;
  savedFilter: SavedFilter;
  activeFilterCount: number;
  /** 検索が失敗したときのメッセージ。成功していれば null。 */
  errorMessage: string | null;
  onClearFilters: () => void;
  onRetry: () => void;
  onShowAllSaved: () => void;
  onGoSearch: () => void;
}): EmptyCopy {
  if (tab === 'saved') {
    if (savedFilter !== 'all') {
      return {
        title: savedFilter === 'want' ? '「行きたい」はまだありません' : '「訪問済み」はまだありません',
        description:
          savedFilter === 'want'
            ? '保存したカフェは、まず「行きたい」に入ります。'
            : '行ったカフェは、詳細で「訪問済み」に切り替えられます。',
        action: { label: 'すべて表示', onClick: onShowAllSaved },
      };
    }

    return {
      title: 'まだ保存したカフェはありません',
      description: '気になるカフェを開いて「保存」すると、ここに並びます。',
      action: { label: 'カフェをさがす', onClick: onGoSearch },
    };
  }

  if (errorMessage) {
    return { title: '検索できませんでした', description: errorMessage, action: { label: 'もう一度さがす', onClick: onRetry } };
  }

  if (activeFilterCount > 0) {
    return {
      title: '条件に合うカフェがありません',
      description: '絞り込みを外すと、ほかのカフェが表示されます。',
      action: { label: '絞り込みを外す', onClick: onClearFilters },
    };
  }

  return {
    title: 'カフェが見つかりませんでした',
    description: '駅名や町名を変えるか、地図を動かして探してみてください。',
  };
}
