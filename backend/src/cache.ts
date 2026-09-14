import type { Env, Lead } from './types';

/** 検索結果の保持期間。店舗情報はそう頻繁に変わらないので長めに取る。 */
const SEARCH_TTL_SECONDS = 60 * 60 * 24; // 24 時間

/**
 * Lead のスキーマ版。**Lead にフィールドを足したら必ず上げること。**
 * 上げないと、旧スキーマのキャッシュが TTL 切れまで新フィールド抜きで返り続ける。
 * v2: weekdayDescriptions / phone を追加
 * v3: priceLevel を追加
 */
const SCHEMA_VERSION = 'v3';

/**
 * 検索条件からキャッシュキーを作る。
 *
 * 座標は 4 桁（約 11m）に丸めることで、わずかにずれた現在地でも
 * 同じキャッシュに当たるようにしている。
 */
export function buildSearchKey(
    params:
        | { mode: 'nearby'; category: string; lat: number; lng: number; radius: number }
        | { mode: 'text'; category: string; area: string },
): string {
    if (params.mode === 'nearby') {
        const { category, lat, lng, radius } = params;
        return `search:${SCHEMA_VERSION}:nearby:${category}:${lat.toFixed(4)}:${lng.toFixed(4)}:${Math.round(radius)}`;
    }
    return `search:${SCHEMA_VERSION}:text:${params.category}:${params.area}`;
}

export async function readSearchCache(env: Env, key: string): Promise<Lead[] | null> {
    try {
        return await env.CACHE.get<Lead[]>(key, 'json');
    } catch (error) {
        // キャッシュの失敗で検索全体を落とさない。
        console.error('cache_read_failed', { key, error: String(error) });
        return null;
    }
}

export async function writeSearchCache(env: Env, key: string, leads: Lead[]): Promise<void> {
    try {
        await env.CACHE.put(key, JSON.stringify(leads), {
            expirationTtl: SEARCH_TTL_SECONDS,
        });
    } catch (error) {
        console.error('cache_write_failed', { key, error: String(error) });
    }
}
