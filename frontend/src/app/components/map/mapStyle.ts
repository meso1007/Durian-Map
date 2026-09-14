/**
 * 地図の見た目。色の正は docs/design-tokens.md「地図スタイル」。
 *
 * ここだけ HEX を直接書いているのは、Google Maps の styles が CSS 変数を
 * 解釈できないため。トークン表の値をそのまま写すこと。
 */

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

export const MARKER_SIZE = 42;
export const MARKER_SIZE_SELECTED = 52;

/**
 * 営業状態 → ピンの枠色。カードの枠線と同じ意味で使う。
 * → docs/design-tokens.md「営業状態の表現」
 */
function statusRingColor(openNow?: boolean): string {
    if (openNow === undefined) return '#FFFFFF';
    // ピン本体が黄緑(#8FC63C)なので、営業中は --durian-green-900 まで落とさないと枠が埋もれる。
    return openNow ? '#14532D' : '#E2467C'; // --durian-green-900 / --tropic-hibiscus-500
}

/**
 * ピンを SVG の data URI として組み立てる。
 * 静的ファイルを状態の数だけ用意するより、枠色だけ差し替えるほうが増やしやすい。
 * 絵柄は従来の marker.svg（ドリアン）を踏襲。
 */
function buildMarkerSvg(openNow: boolean | undefined, selected: boolean): string {
    const ring = statusRingColor(openNow);
    const body = selected ? '#F4D964' : '#8FC63C';
    const seed = selected ? '#274017' : '#284117';
    const spike = selected ? '#FFF8D5' : '#FFF2AE';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <path d="M32 5 C19.3 5 9 15.3 9 28 C9 42.6 32 62.5 32 62.5 C32 62.5 55 42.6 55 28 C55 15.3 44.7 5 32 5 Z"
          fill="${body}" stroke="${ring}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="32" cy="26" r="12" fill="${seed}"/>
    <path d="M30.8 14.6C30.8 13.4 31.8 12.4 33 12.4H34.2V16H30.2L30.8 14.6Z" fill="${spike}"/>
    <path d="M32 16L34.8 18.5L38.8 17.8L39.8 21.7L43.8 23.1L42.3 26.7L44.8 30L41.4 32.4L41 36.3L37 36.5L34.5 39.5L32 37.8L29.5 39.5L27 36.5L23 36.3L22.6 32.4L19.2 30L21.7 26.7L20.2 23.1L24.2 21.7L25.2 17.8L29.2 18.5L32 16Z" fill="${spike}"/>
  </svg>`;
}

export function createCafeMarkerIcon(
    openNow: boolean | undefined,
    selected: boolean,
    sizeOverride?: number,
): google.maps.Icon {
    const size = sizeOverride ?? (selected ? MARKER_SIZE_SELECTED : MARKER_SIZE);

    return {
        url: `data:image/svg+xml,${encodeURIComponent(buildMarkerSvg(openNow, selected))}`,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size),
    };
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
