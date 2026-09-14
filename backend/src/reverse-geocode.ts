import type { Env } from './types';

/**
 * 逆ジオコード（座標 → エリア名）。
 *
 * フロントから Nominatim を直接叩いていたが、
 * (1) ブラウザからは User-Agent を付けられず利用規約（識別可能な UA が必須）を満たせない
 * (2) ユーザーの座標を同意なく第三者へ送ることになる
 * の 2 点で問題があったので Worker 経由にする。
 *
 * Geocoding API を使えば精度は上がるが 1,000 回 $5 かかるのに対し Nominatim は無料。
 * 「だいたいの地名」が分かればよい用途なのでこちらで足りる。
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

/** 利用規約で識別可能な UA が必須。連絡先の分かる URL を含める。 */
const USER_AGENT = 'DurianMap/1.0 (+https://durian-map.pages.dev)';

const TIMEOUT_MS = 5000;

/** 地名はまず変わらないので長めに持つ（1 req/s 制限への配慮も兼ねる）。 */
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 日

/** ズーム 14 ≒ 町・地区レベル。 */
const ZOOM = 14;

type NominatimResponse = {
    address?: {
        city_district?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
    };
};

/** 座標は 3 桁（約 110m）に丸めてキーにする。 */
export function buildReverseGeocodeKey(lat: number, lng: number): string {
    return `revgeo:v1:${lat.toFixed(3)}:${lng.toFixed(3)}`;
}

/**
 * 検索欄に出す「エリア名」を選ぶ。
 *
 * 「渋谷区」より「渋谷」のような生活実感に近い単位を優先したいので、
 * city_district → suburb → city → town → village → county の順で見る。
 */
export function pickAreaName(response: NominatimResponse): string | null {
    const address = response.address;
    if (!address) return null;

    return (
        address.city_district ??
        address.suburb ??
        address.city ??
        address.town ??
        address.village ??
        address.county ??
        null
    );
}

/**
 * 座標からエリア名を引く。失敗しても null を返すだけで、呼び出し側は 200 を返す。
 * 逆ジオコードはあくまで入力補助なので、落ちても検索はできる。
 */
export async function reverseGeocode(env: Env, lat: number, lng: number): Promise<string | null> {
    const key = buildReverseGeocodeKey(lat, lng);

    try {
        const cached = await env.CACHE.get<{ area: string | null }>(key, 'json');
        if (cached) return cached.area;
    } catch (error) {
        console.error('reverse_geocode_cache_read_failed', { error: String(error) });
    }

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', lat.toFixed(3));
    url.searchParams.set('lon', lng.toFixed(3));
    url.searchParams.set('zoom', String(ZOOM));
    url.searchParams.set('accept-language', 'ja');

    let area: string | null = null;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) {
            console.error('reverse_geocode_failed', { status: response.status });
            return null;
        }

        area = pickAreaName((await response.json()) as NominatimResponse);
    } catch (error) {
        console.error('reverse_geocode_error', { error: String(error) });
        return null;
    }

    // 見つからなかった場合も保存する（同じ座標で毎回叩かないため）。
    try {
        await env.CACHE.put(key, JSON.stringify({ area }), {
            expirationTtl: CACHE_TTL_SECONDS,
        });
    } catch (error) {
        console.error('reverse_geocode_cache_write_failed', { error: String(error) });
    }

    return area;
}
