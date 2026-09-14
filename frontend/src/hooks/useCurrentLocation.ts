'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { reverseGeocode } from '@/lib/api';
import type { Coordinates } from '@/lib/api';
import { GeolocationError, getCurrentPosition, hasGrantedPermission } from '@/lib/geolocation';

/**
 * getCurrentPosition が返ってこないことがある（WebView でダイアログが裏に回る、
 * 端末側が沈黙する等）。スピナーが回りっぱなしで CTA が押せなくなるのを防ぐ。
 */
const WATCHDOG_MS = 12000;

const UNKNOWN_ERROR = '現在地を取得できませんでした。端末の位置情報権限をご確認ください。';

/**
 * 現在地と、その座標から引いた地名。
 *
 * 起動時は「権限がすでに許可されている場合だけ」静かに取りに行く。
 * 未許可の状態でいきなり OS のダイアログを出すと、アプリの説明を読む前に
 * 拒否されやすく、一度拒否されると「近くからさがす」が永久に効かなくなる。
 */
export function useCurrentLocation({
    onError,
    onLocated,
}: {
    onError: (message: string) => void;
    /** ユーザー操作で取得できたとき。ここから現在地検索を始める。 */
    onLocated: (coordinates: Coordinates) => void;
}) {
    const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    /**
     * 座標から引いた地名。入力欄とは**別の state**にする。
     * ユーザーが打った文字を非同期の結果で上書きしない（docs/design.md 1節）。
     */
    const [resolvedAreaName, setResolvedAreaName] = useState<string | null>(null);

    // 暗黙取得とユーザー操作が同時に走りうる。古い座標でピンを巻き戻さないよう、
    // 最後に始めた取得だけを採用する。
    const requestId = useRef(0);
    const watchdogRef = useRef<number | null>(null);

    const stopLocating = useCallback(() => {
        setIsLocating(false);
        if (watchdogRef.current !== null) {
            window.clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
        }
    }, []);

    useEffect(() => stopLocating, [stopLocating]);

    const resolveAreaName = useCallback(async (target: Coordinates, generation: number) => {
        const area = await reverseGeocode(target);
        if (generation !== requestId.current) return;
        if (area) setResolvedAreaName(area);
    }, []);

    const acquire = useCallback(
        async ({ interactive }: { interactive: boolean }) => {
            const generation = ++requestId.current;

            if (interactive) {
                setIsLocating(true);
                watchdogRef.current = window.setTimeout(() => {
                    if (generation !== requestId.current) return;
                    stopLocating();
                    onError('現在地の取得に時間がかかっています。もう一度お試しください。');
                }, WATCHDOG_MS);
            }

            try {
                const position = await getCurrentPosition();
                if (generation !== requestId.current) return;

                setCoordinates(position);
                void resolveAreaName(position, generation);

                if (!interactive) return;

                stopLocating();
                onLocated(position);
            } catch (error) {
                if (generation !== requestId.current) return;
                if (!interactive) return; // 暗黙の取得では黙って諦める

                stopLocating();
                onError(error instanceof GeolocationError ? error.message : UNKNOWN_ERROR);
            }
        },
        [onError, onLocated, resolveAreaName, stopLocating],
    );

    // 起動時の暗黙取得。権限がすでに granted のときだけ。
    useEffect(() => {
        let cancelled = false;

        void hasGrantedPermission().then((granted) => {
            if (!cancelled && granted) void acquire({ interactive: false });
        });

        return () => {
            cancelled = true;
        };
    }, [acquire]);

    /** ユーザーが「近くからさがす」を押したとき。 */
    const locate = useCallback(() => void acquire({ interactive: true }), [acquire]);

    return { coordinates, resolvedAreaName, isLocating, locate };
}
