'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Cafe } from '@/lib/api';
import { loadSavedCafes, saveSavedCafes } from '@/lib/storage';
import type { SavedCafe, SavedStatus } from '@/lib/storage';

/** 保存済みカフェ。永続化は lib/storage.ts（iOS では Preferences に差し替わる）。 */
export function useSavedCafes() {
    const [savedCafes, setSavedCafes] = useState<SavedCafe[]>([]);

    // 保存済みはマウント後に復元する（静的書き出しとのハイドレーション不一致を防ぐ）。
    useEffect(() => {
        void loadSavedCafes().then(setSavedCafes);
    }, []);

    const persist = useCallback((next: SavedCafe[]) => {
        setSavedCafes(next);
        void saveSavedCafes(next);
    }, []);

    const toggleSave = useCallback(
        (cafe: Cafe) => {
            const isSaved = savedCafes.some((saved) => saved.id === cafe.id);

            persist(
                isSaved
                    ? savedCafes.filter((saved) => saved.id !== cafe.id)
                    // 保存した直後は「行きたい」。訪問済みは詳細画面で切り替える。
                    : [...savedCafes, { ...cafe, status: 'want' as const, savedAt: new Date().toISOString() }],
            );
        },
        [savedCafes, persist],
    );

    const setStatus = useCallback(
        (cafeId: string, status: SavedStatus) => {
            persist(savedCafes.map((saved) => (saved.id === cafeId ? { ...saved, status } : saved)));
        },
        [savedCafes, persist],
    );

    const getStatus = useCallback(
        (cafeId: string): SavedStatus | undefined => savedCafes.find((saved) => saved.id === cafeId)?.status,
        [savedCafes],
    );

    return { savedCafes, toggleSave, setStatus, getStatus };
}
