/**
 * 地図のピンの見た目。Google マップ用の SVG と、代替表示（MapFallback）の両方がここを使う。
 * 色の正は docs/design-tokens.md。ここに HEX を直接書いているのは、SVG の data URI と
 * Google Maps の styles が CSS 変数を解釈できないため。トークン表の値をそのまま写すこと。
 */

export type PinState = 'default' | 'hover' | 'selected';

export type PinColors = { fill: string; stroke: string; text: string; star: string };

/**
 * 営業状態 → 枠の色。カードの営業状態の点と同じ意味で使う。
 * → docs/design-tokens.md「営業状態の表現」
 */
function statusStroke(openNow?: boolean): string {
    if (openNow === undefined) return '#5C6B4A'; // --durian-seed-600
    return openNow ? '#14532D' : '#E2467C'; // --durian-green-900 / --tropic-hibiscus-500
}

export function getPinColors(openNow: boolean | undefined, state: PinState): PinColors {
    if (state === 'selected') {
        // 選択中は濃緑の面に反転させる。枠も同色にして、状態色より「選んでいること」を優先する。
        return { fill: '#17492E', stroke: '#17492E', text: '#FFF7E2', star: '#FFB020' };
    }

    return {
        fill: state === 'hover' ? '#E4F3BA' : '#FFF7E6', // --durian-lime-100 / --durian-cream-50
        stroke: statusStroke(openNow),
        text: '#1F3218', // --durian-seed-900
        star: '#D97706', // --tropic-mango-700（クリーム地で 3:1 を満たす濃さ）
    };
}

/** 評価の札を最初から出す店の数。全部に出すと札どうしが重なって読めなくなる。 */
const FEATURED_COUNT = 5;

/**
 * 評価の札を最初から出す店（評価の高い順に数件）。
 * それ以外は小さな丸いピンにしておき、選んだとき・一覧でポインタを載せたときに札へ変える。
 */
export function getFeaturedIds(cafes: readonly { id: string; rating?: number; userRatingCount?: number }[]): Set<string> {
    return new Set(
        cafes
            .filter((cafe) => cafe.rating != null)
            .sort((a, b) => b.rating! - a.rating! || (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0))
            .slice(0, FEATURED_COUNT)
            .map((cafe) => cafe.id),
    );
}

/** そのピンを札（星 + 評価）で出すか。評価が無ければ常に丸いピン。 */
export function showsRating(rating: number | undefined, featured: boolean, state: PinState): boolean {
    return rating != null && (featured || state !== 'default');
}

/** 保存済みの印（右上の点）。 */
export const PIN_SAVED_COLOR = '#E2467C'; // --tropic-hibiscus-500
