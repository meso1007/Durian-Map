/**
 * 画面の骨格の寸法と、そこから決まる「地図のうち UI に覆われている幅・高さ」。
 *
 * 地図は全面に敷いてあるので、視点の寄せ方・ピンの収め方・Google のロゴの位置は
 * どれも「どこが覆われているか」を知らないと決められない。CSS 側の値と必ずそろえること。
 * → docs/design.md 4.5節
 */

import { getSnapHeights } from './sheet';
import type { SheetSnap } from './sheet';

/** 地図のうち UI が覆っている帯の太さ（px）。 */
export type MapInsets = { top: number; right: number; bottom: number; left: number };

/** PC: パネルの幅と、画面の端からの余白。page.tsx の md:w-[416px] / lg:w-[448px]・md:p-4 と対応。 */
const DESKTOP_PANEL_WIDTH = 416;
const DESKTOP_PANEL_WIDTH_LG = 448;
const DESKTOP_LG_MIN_WIDTH = 1024;

/** モバイル: 検索バーの下端まで（上の余白 8 + 高さ 56 + 下の余白 8）。globals.css の --dm-sheet-top と対応。 */
export const MOBILE_TOP_BAR = 72;

export function getSheetHeights(viewport: { height: number; safeTop: number; safeBottom: number }) {
    return getSnapHeights(viewport.height, {
        topInset: MOBILE_TOP_BAR + viewport.safeTop,
        bottomInset: viewport.safeBottom,
    });
}

export function getMapInsets(
    viewport: { width: number; height: number; isDesktop: boolean; safeTop: number; safeBottom: number },
    snap: SheetSnap,
): MapInsets {
    if (viewport.isDesktop) {
        const panel = viewport.width >= DESKTOP_LG_MIN_WIDTH ? DESKTOP_PANEL_WIDTH_LG : DESKTOP_PANEL_WIDTH;
        return { top: 0, right: 0, bottom: 0, left: panel };
    }

    const heights = getSheetHeights(viewport);

    return {
        top: MOBILE_TOP_BAR + viewport.safeTop,
        right: 0,
        // 全面に開いているとき、地図はほぼ見えない。half の位置を基準にしておくと、
        // シートを下げた瞬間に視点がずれない。
        bottom: Math.min(heights[snap], heights.half),
        left: 0,
    };
}
