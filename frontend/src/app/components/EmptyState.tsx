'use client';

import { CupIcon } from './icons';

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
