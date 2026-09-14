'use client';

import { useCallback, useEffect, useState } from 'react';

/** エラーは --dm-error、完了の通知は --dm-success（docs/design-tokens.md）。 */
export type Toast = { message: string; tone: 'error' | 'success' };

const AUTO_HIDE_MS = 4000;

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

        const timer = window.setTimeout(() => setToast(null), AUTO_HIDE_MS);
        return () => window.clearTimeout(timer);
    }, [toast]);

    return { toast, showError, showNotice };
}
