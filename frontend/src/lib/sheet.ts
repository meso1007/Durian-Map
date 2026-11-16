/**
 * ボトムシートの段（スナップ）の計算。DOM に触らない純関数だけを置く。
 *
 * シートは 3 段階で止まる。→ docs/design.md 4.5節
 * - peek: 切り替えの行だけ見える。地図を広く見たいとき
 * - half: 画面の半分。地図と一覧を並べて見る既定の段
 * - full: 検索バーの直下まで。一覧や詳細を読むとき
 */

export type SheetSnap = 'peek' | 'half' | 'full';

export const SHEET_SNAPS: readonly SheetSnap[] = ['peek', 'half', 'full'];

/** peek で見せる高さ（ハンドル + 切り替えの行）。セーフエリアは呼び出し側で足す。 */
export const SHEET_PEEK_HEIGHT = 96;

/** これより速く払ったら、位置に関係なく払った向きの隣の段へ送る（px/ms）。 */
const FLING_VELOCITY = 0.45;

/** 各段で「見えている高さ」(px)。 */
export function getSnapHeights(
    viewportHeight: number,
    { topInset, bottomInset }: { topInset: number; bottomInset: number },
): Record<SheetSnap, number> {
    const full = Math.max(0, viewportHeight - topInset);
    const peek = Math.min(full, SHEET_PEEK_HEIGHT + bottomInset);
    // half は peek と full の間に必ず収める（横向きの低い画面で 3 段が潰れないように）。
    const half = Math.min(full, Math.max(peek, Math.round(viewportHeight * 0.5)));

    return { peek, half, full };
}

/**
 * 指を離したときに止まる段を決める。
 *
 * @param visibleHeight 離した瞬間に見えている高さ
 * @param velocity 上向きを正とした速度（px/ms）
 */
export function resolveSnap(
    visibleHeight: number,
    velocity: number,
    heights: Record<SheetSnap, number>,
): SheetSnap {
    const nearest = SHEET_SNAPS.reduce((best, snap) =>
        Math.abs(heights[snap] - visibleHeight) < Math.abs(heights[best] - visibleHeight) ? snap : best,
    );

    if (Math.abs(velocity) < FLING_VELOCITY) return nearest;

    // 払った向きにある段のうち、いちばん近いもの。無ければ端で止まる。
    const candidates = SHEET_SNAPS.filter((snap) =>
        velocity > 0 ? heights[snap] > visibleHeight : heights[snap] < visibleHeight,
    );
    if (candidates.length === 0) return nearest;

    return candidates.reduce((best, snap) =>
        Math.abs(heights[snap] - visibleHeight) < Math.abs(heights[best] - visibleHeight) ? snap : best,
    );
}

/**
 * ハンドルをタップ / Enter したときの次の段。half → full → peek → half と一巡する。
 * ドラッグできない人（単一のタップしか使えない人）も、すべての段に届くようにするため。
 */
export function nextSnap(current: SheetSnap): SheetSnap {
    return current === 'half' ? 'full' : current === 'full' ? 'peek' : 'half';
}

/** 端を越えて引いたときの手応え。越えた分は 1/4 しか動かさない。 */
export function rubberBand(visibleHeight: number, heights: Record<SheetSnap, number>): number {
    if (visibleHeight > heights.full) return heights.full + (visibleHeight - heights.full) / 4;
    if (visibleHeight < heights.peek) return heights.peek - (heights.peek - visibleHeight) / 4;
    return visibleHeight;
}
