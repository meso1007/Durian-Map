'use client';

import { useCallback, useEffect, useState } from 'react';

/** エラーは --dm-error、完了の通知は --dm-success（docs/design-tokens.md）。 */
export type Toast = { message: string; tone: 'error' | 'success' };

/** 完了の通知は短く。エラーは読む時間が要るので長く出し、閉じるボタンも付ける（Toast.tsx）。 */
const AUTO_HIDE_MS = { success: 4000, error: 10000 } as const;

/**
 * 画面上部のトースト。
 *
 * 「無言で失敗させない」（docs/design.md 5節）を満たすための唯一の通知手段。
 * alert() は iOS の WebView でアプリ全体を止めるので使わない。
 */
export function useToast() {
    const [toast, setToast] = useState<Toast | null>(null);

    const showError = useCallback((message: string) => setToast({ message, tone: 'error' }), []);
    const showNotice = useCallback((message: string) => setToast({ message, tone: 'success' }), []);

    useEffect(() => {
        if (!toast) return;

        const timer = window.setTimeout(() => setToast(null), AUTO_HIDE_MS[toast.tone]);
        return () => window.clearTimeout(timer);
    }, [toast]);

    const dismissToast = useCallback(() => setToast(null), []);

    return { toast, showError, showNotice, dismissToast };
}
