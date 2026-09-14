import type { Env } from './types';

/**
 * KV による簡易レート制限。
 *
 * 目的は Places API の課金を守ることであって、厳密な制限ではない。
 * KV は結果整合なので多少の超過は許容する。
 */
const WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 30;

export type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
};

export async function checkRateLimit(env: Env, clientId: string): Promise<RateLimitResult> {
    const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const key = `ratelimit:${clientId}:${window}`;

    try {
        const current = Number((await env.CACHE.get(key)) ?? '0');
        const next = current + 1;

        if (next > MAX_REQUESTS_PER_WINDOW) {
            return {
                allowed: false,
                remaining: 0,
                retryAfterSeconds: WINDOW_SECONDS,
            };
        }

        // ウィンドウ 2 つ分で期限切れにしておけば取りこぼしがない。
        await env.CACHE.put(key, String(next), { expirationTtl: WINDOW_SECONDS * 2 });

        return {
            allowed: true,
            remaining: MAX_REQUESTS_PER_WINDOW - next,
            retryAfterSeconds: 0,
        };
    } catch (error) {
        // KV が落ちているときにサービス全体を止めない（fail open）。
        console.error('ratelimit_failed', { clientId, error: String(error) });
        return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW, retryAfterSeconds: 0 };
    }
}
