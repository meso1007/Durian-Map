import type { CachedCafe, Env } from './types';

/**
 * 検索結果の保持期間。
 *
 * 営業状態は `periods` からレスポンス時に計算するので、長く持っても嘘にならない。
 * Places のキャッシュ規約の上限は 30 日だが、閉店・移転の反映を考えて 7 日にする。
 */
const SEARCH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 日

/**
 * キャッシュのスキーマ版。**保存する形を変えたら必ず上げること。**
 * 上げないと、旧スキーマのキャッシュが TTL 切れまで返り続ける。
 * v2: weekdayDescriptions / phone を追加
 * v3: priceLevel を追加
 * v4: periods を保存して openNow をレスポンス時に計算する形へ。キーを SHA-256 に
 */
const SCHEMA_VERSION = 'v4';

export type SearchKeyParams =
    | { mode: 'nearby'; category: string; lat: number; lng: number; radius: number }
    | { mode: 'text'; category: string; area: string };

/**
 * 検索条件からキャッシュキーを作る。
 *
 * 平文を `:` で連結していた頃は `area` に `:` を含めるだけで別条件のキーを
 * 作れてしまい（キャッシュポイズニング）、長い入力では KV のキー上限 512B を
 * 超えて**静かにキャッシュが効かなくなる**問題もあった。
 * 正規化した JSON の SHA-256 なら、長さは一定で衝突も作れない。
 *
 * 座標は 3 桁（約 110m）に丸める。4 桁（約 11m）だと現在地が少しずれるだけで
 * 別キーになり、ヒット率が出なかった。
 */
export async function buildSearchKey(params: SearchKeyParams): Promise<string> {
    const canonical =
        params.mode === 'nearby'
            ? JSON.stringify({
                  m: 'nearby',
                  c: params.category,
                  lat: params.lat.toFixed(3),
                  lng: params.lng.toFixed(3),
                  r: Math.round(params.radius),
              })
            : JSON.stringify({ m: 'text', c: params.category, a: params.area });

    return `search:${SCHEMA_VERSION}:${await sha256Hex(canonical)}`;
}

export async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readSearchCache(env: Env, key: string): Promise<CachedCafe[] | null> {
    try {
        return await env.CACHE.get<CachedCafe[]>(key, 'json');
    } catch (error) {
        // キャッシュの失敗で検索全体を落とさない。
        console.error('cache_read_failed', { key, error: String(error) });
        return null;
    }
}

export async function writeSearchCache(
    env: Env,
    key: string,
    cafes: CachedCafe[],
): Promise<void> {
    try {
        await env.CACHE.put(key, JSON.stringify(cafes), {
            expirationTtl: SEARCH_TTL_SECONDS,
        });
    } catch (error) {
        console.error('cache_write_failed', { key, error: String(error) });
    }
}
