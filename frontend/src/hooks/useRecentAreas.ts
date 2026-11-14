'use client';

import { useCallback, useEffect, useState } from 'react';

import { addRecentArea, loadRecentAreas, saveRecentAreas } from '@/lib/storage';

/**
 * 最近検索したエリア（新しい順）。初回表示で「前に探した場所」へ戻るために使う。
 * 永続化は lib/storage.ts（iOS では Preferences に差し替わる）。
 */
export function useRecentAreas() {
    const [areas, setAreas] = useState<string[]>([]);

    // マウント後に復元する（静的書き出しとのハイドレーション不一致を防ぐ）。
    useEffect(() => {
        void loadRecentAreas().then(setAreas);
    }, []);

    const remember = useCallback((area: string) => {
        setAreas((previous) => {
            const next = addRecentArea(previous, area);
            void saveRecentAreas(next);
            return next;
        });
    }, []);

    return { recentAreas: areas, rememberArea: remember };
}
