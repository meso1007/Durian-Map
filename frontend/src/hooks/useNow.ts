'use client';

import { useEffect, useState } from 'react';

/**
 * いまの時刻（ms）。1 分ごとに更新する。
 *
 * 「あと 45 分で閉店」のような残り時間は、描画した瞬間の時刻で固まると嘘になる。
 * 一覧や詳細の親で 1 つだけ持ち、子へ渡す（カードごとにタイマーを持たせない）。
 */
export function useNow(intervalMs = 60_000): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(timer);
    }, [intervalMs]);

    return now;
}
