'use client';

import { AlertIcon, CheckIcon, CloseIcon } from './icons';
import type { Toast as ToastValue } from '@/hooks/useToast';

/**
 * トースト。エラーと完了通知の両方に使う。地図の上（モバイルは検索バーの下）に浮く。
 *
 * 領域は常に DOM に置く。role="status" の要素ごと出し入れすると読み上げが安定しないため。
 * エラーは --dm-error、完了は濃い面 + ライムの印（どちらも白系の文字で 4.5:1 以上）。
 */
export default function Toast({ toast, onDismiss }: { toast: ToastValue | null; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(4.75rem+env(safe-area-inset-top))] z-50 flex justify-center px-4 md:top-6 md:pl-[448px]"
    >
      {toast && (
        <div
          // 同じ文言が続けて出ても動きをやり直す
          key={`${toast.tone}:${toast.message}`}
          className={`pointer-events-auto flex max-w-md animate-pop items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-float ${toast.tone === 'error' ? 'bg-error text-white' : 'bg-primary-deepest text-cream'}`}
        >
          {toast.tone === 'error' ? (
            <AlertIcon className="h-5 w-5 shrink-0" />
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-primary-deepest">
              <CheckIcon className="h-3 w-3" />
            </span>
          )}
          <span>{toast.message}</span>
          {toast.tone === 'error' && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="閉じる"
              className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
