'use client';

import { useSyncExternalStore } from 'react';

/** PC のレイアウトに切り替わる幅。Tailwind の `md` と同じ。 */
export const DESKTOP_MIN_WIDTH = 768;

export type Viewport = {
    width: number;
    height: number;
    isDesktop: boolean;
    /** env(safe-area-inset-*) の実測値（px）。Web では 0。 */
    safeTop: number;
    safeBottom: number;
};

/**
 * 静的書き出しの HTML とハイドレーション直後は、この値で描く。
 * モバイルを既定にしているのは、利用の中心がモバイルで、PC の見た目は CSS（md:）だけで決まるため。
 */
const SERVER_VIEWPORT: Viewport = { width: 390, height: 844, isDesktop: false, safeTop: 0, safeBottom: 0 };

let cached: Viewport = SERVER_VIEWPORT;
let probe: HTMLDivElement | null = null;

/** CSS の env() は JS から直接読めないので、padding に写した要素を測る。 */
function readSafeArea(): { safeTop: number; safeBottom: number } {
    if (!probe) {
        probe = document.createElement('div');
        probe.style.cssText =
            'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;' +
            'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
        document.body.appendChild(probe);
    }

    const style = window.getComputedStyle(probe);
    return { safeTop: parseFloat(style.paddingTop) || 0, safeBottom: parseFloat(style.paddingBottom) || 0 };
}

function read(): Viewport {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { safeTop, safeBottom } = readSafeArea();

    // 値が同じなら同じオブジェクトを返す（useSyncExternalStore は参照で変化を判定する）。
    if (
        cached.width === width &&
        cached.height === height &&
        cached.safeTop === safeTop &&
        cached.safeBottom === safeBottom
    ) {
        return cached;
    }

    cached = { width, height, isDesktop: width >= DESKTOP_MIN_WIDTH, safeTop, safeBottom };
    return cached;
}

function subscribe(onChange: () => void): () => void {
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);

    return () => {
        window.removeEventListener('resize', onChange);
        window.removeEventListener('orientationchange', onChange);
    };
}

/**
 * 画面の大きさとセーフエリア。
 *
 * レイアウトそのものは CSS で切り替える。ここを使うのは、地図の視点の寄せ方や
 * シートの段の高さのように、px の実値が要る計算だけ。
 */
export function useViewport(): Viewport {
    return useSyncExternalStore(subscribe, read, () => SERVER_VIEWPORT);
}
