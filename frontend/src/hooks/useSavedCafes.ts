'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Cafe } from '@/lib/api';
import { loadSavedCafes, saveSavedCafes } from '@/lib/storage';
import type { SavedCafe, SavedStatus } from '@/lib/storage';

const SAVE_FAILED = '保存できませんでした。端末の空き容量をご確認ください。';

/**
 * 保存済みカフェ。永続化は lib/storage.ts（iOS では Preferences に差し替わる）。
 *
 * 画面を先に更新してから書き込む（楽観更新）。失敗したら直前の状態へ戻し、
 * トーストで伝える。黙って元に戻る UI が一番たちが悪い（docs/design.md 5節）。
 */
export function useSavedCafes({
    onError,
    onNotice,
}: {
    onError: (message: string) => void;
    onNotice: (message: string) => void;
}) {
    const [savedCafes, setSavedCafes] = useState<SavedCafe[]>([]);

    // 保存済みはマウント後に復元する（静的書き出しとのハイドレーション不一致を防ぐ）。
    useEffect(() => {
        void loadSavedCafes().then(setSavedCafes);
    }, []);

    const persist = useCallback(
        async (next: SavedCafe[], previous: SavedCafe[]): Promise<boolean> => {
            setSavedCafes(next);

            if (await saveSavedCafes(next)) return true;

            setSavedCafes(previous);
            onError(SAVE_FAILED);
            return false;
        },
        [onError],
    );

    const toggleSave = useCallback(
        async (cafe: Cafe) => {
            const previous = savedCafes;
            const isSaved = previous.some((saved) => saved.id === cafe.id);

            const next = isSaved
                ? previous.filter((saved) => saved.id !== cafe.id)
                // 保存した直後は「行きたい」。訪問済みは詳細画面で切り替える。
                : [...previous, { ...cafe, status: 'want' as const, savedAt: new Date().toISOString() }];

            if (await persist(next, previous)) {
                onNotice(isSaved ? '保存を解除しました' : '保存しました');
            }
        },
        [savedCafes, persist, onNotice],
    );

    const setStatus = useCallback(
        async (cafeId: string, status: SavedStatus) => {
            const previous = savedCafes;
            await persist(
                previous.map((saved) => (saved.id === cafeId ? { ...saved, status } : saved)),
                previous,
            );
        },
        [savedCafes, persist],
    );

    const getStatus = useCallback(
        (cafeId: string): SavedStatus | undefined => savedCafes.find((saved) => saved.id === cafeId)?.status,
        [savedCafes],
    );

    return { savedCafes, toggleSave, setStatus, getStatus };
}
