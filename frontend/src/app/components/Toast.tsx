'use client';

import { AlertIcon } from './icons';
import type { Toast as ToastValue } from '@/hooks/useToast';

/**
 * 画面上部のトースト。エラーと完了通知の両方に使う。
 *
 * 領域は常に DOM に置いたまま不透明度だけ変える。role="status" の中身を
 * 出し入れすると読み上げが安定しないため。
 */
export default function Toast({ toast }: { toast: ToastValue | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 pointer-events-none w-[calc(100%-2rem)] md:w-auto flex justify-center ${toast ? 'opacity-100' : 'opacity-0'}`}
      style={{ top: 'calc(6rem + env(safe-area-inset-top))' }}
    >
      {toast && (
        <div
          className={`${toast.tone === 'error' ? 'bg-error' : 'bg-success'} text-white px-4 py-3 rounded-xl shadow-card text-sm font-bold flex items-center gap-2 max-w-md`}
        >
          <AlertIcon />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
