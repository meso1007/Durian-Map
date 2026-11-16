'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { addRecentArea, loadRecentAreas, saveRecentAreas } from '@/lib/storage';

/**
 * 最近検索したエリア（新しい順）。初回表示で「前に探した場所」へ戻るために使う。
 * 永続化は lib/storage.ts（iOS では Preferences に差し替わる）。
 */
export function useRecentAreas() {
    const [areas, setAreas] = useState<string[]>([]);

    // 最新の一覧。保存する値をここから作る（state の更新関数の中で保存しない: 更新関数は純粋に保つ）。
    const areasRef = useRef<string[]>([]);

    // マウント後に復元する（静的書き出しとのハイドレーション不一致を防ぐ）。
    useEffect(() => {
        void loadRecentAreas().then((stored) => {
            // 読み込みが終わる前に検索された分（iOS の Preferences は遅い）を、保存済みの前に足す。
            const merged = areasRef.current.reduceRight((list, area) => addRecentArea(list, area), stored);

            areasRef.current = merged;
            setAreas(merged);
            if (merged.length !== stored.length || merged.some((area, index) => area !== stored[index])) {
                void saveRecentAreas(merged);
            }
        });
    }, []);

    const remember = useCallback((area: string) => {
        const next = addRecentArea(areasRef.current, area);

        areasRef.current = next;
        setAreas(next);
        void saveRecentAreas(next);
    }, []);

    return { recentAreas: areas, rememberArea: remember };
}
