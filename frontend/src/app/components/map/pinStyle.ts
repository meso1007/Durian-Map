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

/** 保存済みの印（右上の点）。 */
export const PIN_SAVED_COLOR = '#E2467C'; // --tropic-hibiscus-500
