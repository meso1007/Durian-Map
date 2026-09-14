/**
 * 距離まわりの純関数。
 *
 * 扱うのは実データだけ（端末の座標 × Places の座標）。どちらかが欠けたら null を返し、
 * 呼び出し側が「出さない」を選べるようにする。
 */

import type { Cafe, Coordinates } from './api';

const EARTH_RADIUS_METERS = 6371000;

/** 徒歩の速度。不動産表示の慣習に合わせて 80m/分。 */
const WALKING_METERS_PER_MINUTE = 80;

/** 現在地からの直線距離（m）。座標が欠けていれば null。 */
export function getDistanceMeters(from: Coordinates | null, cafe: Cafe): number | null {
    if (!from || cafe.lat == null || cafe.lng == null) {
        return null;
    }

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(cafe.lat - from.lat);
    const dLng = toRad(cafe.lng - from.lng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(from.lat)) * Math.cos(toRad(cafe.lat)) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters: number): string {
    return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 徒歩の目安（「約4分」）。直線距離なので実際の道のりより短く出る。
 * 1 分未満は「約1分」に丸める（「約0分」は意味を成さない）。
 */
export function formatWalkingMinutes(meters: number): string {
    return `約${Math.max(1, Math.round(meters / WALKING_METERS_PER_MINUTE))}分`;
}
