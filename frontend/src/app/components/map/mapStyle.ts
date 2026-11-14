/**
 * Google マップの見た目。色の正は docs/design-tokens.md「地図スタイル」。
 *
 * ここだけ HEX を直接書いているのは、Google Maps の styles が CSS 変数を
 * 解釈できないため。トークン表の値をそのまま写すこと。
 */

import type { Cafe } from '@/lib/api';

import { PIN_SAVED_COLOR, getPinColors, showsRating } from './pinStyle';
import type { PinState } from './pinStyle';

export const MAP_BACKGROUND = '#EEF5D9';

export const MAP_STYLE: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#EEF5D9' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#5C6B4A' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#EEF5D9' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#EEF5D9' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EEF5D9' }] },

    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D5EBB0' }, { visibility: 'on' }] },

    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    // 駅名・地名は表示する（docs/design-tokens.md）
    { featureType: 'transit.station', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },

    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'road.local', elementType: 'labels.text', stylers: [{ visibility: 'off' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#F7E9B5' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F7E9B5' }] },

    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFEDEB' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5C6B4A' }] },

    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];

/** ピンに必要な情報だけを抜いたもの。これが変わったときだけ描き直す。 */
export type PinData = { rating?: number; openNow?: boolean; saved: boolean; featured: boolean };

export function toPinData(cafe: Cafe, saved: boolean, featured: boolean): PinData {
    return { rating: cafe.rating, openNow: cafe.openNow, saved, featured };
}

export function samePinData(a: PinData, b: PinData): boolean {
    return a.rating === b.rating && a.openNow === b.openNow && a.saved === b.saved && a.featured === b.featured;
}

// 評価つきのピン: 角丸の札 + 下向きのしっぽ。星は SVG、数値は Marker の label で重ねる
// （data URI の SVG はページのフォントを使えないので、Co Headline で出すには label が要る）。
const PILL = { width: 58, height: 38, bodyHeight: 30 };
// 評価の無い店: 小さな丸いピン。
const DOT = { width: 26, height: 32 };

const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

function savedBadge(x: number, fill: string): string {
    return `<circle cx="${x}" cy="6" r="5" fill="${PIN_SAVED_COLOR}" stroke="${fill}" stroke-width="2"/>`;
}

function buildPillSvg(data: PinData, state: PinState): string {
    const { fill, stroke, star } = getPinColors(data.openNow, state);
    const { width, height, bodyHeight } = PILL;
    const middle = width / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="M${middle - 6} ${bodyHeight - 1} L${middle} ${height - 1} L${middle + 6} ${bodyHeight - 1} Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="1" y="1" width="${width - 2}" height="${bodyHeight - 2}" rx="${(bodyHeight - 2) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <path d="M${middle - 5} ${bodyHeight - 2.2} L${middle + 5} ${bodyHeight - 2.2}" stroke="${fill}" stroke-width="2.4"/>
    <g transform="translate(9 8.5) scale(0.56)"><path d="${STAR_PATH}" fill="${star}"/></g>
    ${data.saved ? savedBadge(width - 8, fill) : ''}
  </svg>`;
}

function buildDotSvg(data: PinData, state: PinState): string {
    const { fill, stroke } = getPinColors(data.openNow, state);
    const { width, height } = DOT;
    const middle = width / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="M${middle} ${height - 1} C${middle} ${height - 1} 2 19 2 12.5 A${middle - 2} ${middle - 2} 0 1 1 ${width - 2} 12.5 C${width - 2} 19 ${middle} ${height - 1} ${middle} ${height - 1} Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${middle}" cy="12.5" r="4" fill="${state === 'selected' ? '#B9DC3C' : stroke}"/>
    ${data.saved ? savedBadge(width - 6, fill) : ''}
  </svg>`;
}

/** 選択中は 1.2 倍にする（しっぽの先を基準に拡大するので、指している位置は動かない）。 */
function pinScale(state: PinState): number {
    return state === 'selected' ? 1.2 : 1;
}

export function createCafePinIcon(data: PinData, state: PinState): google.maps.Icon {
    const hasRating = showsRating(data.rating, data.featured, state);
    const base = hasRating ? PILL : DOT;
    const scale = pinScale(state);
    const width = base.width * scale;
    const height = base.height * scale;

    return {
        url: `data:image/svg+xml,${encodeURIComponent(hasRating ? buildPillSvg(data, state) : buildDotSvg(data, state))}`,
        scaledSize: new google.maps.Size(width, height),
        anchor: new google.maps.Point(width / 2, height),
        // 数値は星の右。札の縦の中央に置く。
        labelOrigin: new google.maps.Point(36 * scale, (PILL.bodyHeight / 2) * scale),
    };
}

let displayFontFamily: string | null = null;

/**
 * 数値用の書体（Co Headline）。next/font が付ける実際の family 名は CSS 変数から読む。
 * Marker の label は CSS のクラスを当てられないので、名前で指定するしかない。
 */
function getDisplayFontFamily(): string {
    if (displayFontFamily === null) {
        const value = window.getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
        displayFontFamily = value ? `${value}, sans-serif` : 'sans-serif';
    }

    return displayFontFamily;
}

/** 評価の数値。評価の無い店は label を付けない。 */
export function createCafePinLabel(data: PinData, state: PinState): google.maps.MarkerLabel | null {
    if (data.rating == null || !showsRating(data.rating, data.featured, state)) return null;

    return {
        text: data.rating.toFixed(1),
        color: getPinColors(data.openNow, state).text,
        fontFamily: getDisplayFontFamily(),
        fontSize: state === 'selected' ? '15px' : '13px',
        fontWeight: '700',
    };
}

/** クラスタ（近いピンをまとめた丸）。ライムの面に濃緑の数。 */
export function createClusterIcon(): google.maps.Icon {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="20" fill="#A8CF3B" stroke="#FFF7E6" stroke-width="3"/>
  </svg>`;

    return {
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(44, 44),
        anchor: new google.maps.Point(22, 22),
    };
}

export function createClusterLabel(count: number): google.maps.MarkerLabel {
    return { text: String(count), color: '#17492E', fontFamily: getDisplayFontFamily(), fontSize: '14px', fontWeight: '700' };
}

/** 現在地マーカーの二重丸。色は --tropic-lagoon-500。 */
export const CURRENT_LOCATION_RING: Omit<google.maps.Symbol, 'path'> = {
    fillColor: '#2BB3B1',
    fillOpacity: 0.18,
    strokeColor: '#2BB3B1',
    strokeOpacity: 0.5,
    strokeWeight: 1,
    scale: 18,
};

export const CURRENT_LOCATION_DOT: Omit<google.maps.Symbol, 'path'> = {
    fillColor: '#2BB3B1',
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeOpacity: 1,
    strokeWeight: 3,
    scale: 7,
};
