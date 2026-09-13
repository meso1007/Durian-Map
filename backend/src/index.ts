import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { buildSearchKey, readSearchCache, writeSearchCache } from './cache';
import { chainListSize, isChainCafe } from './chains';
import { PlacesApiError, fetchPhoto, searchPlaces } from './places';
import { checkRateLimit } from './ratelimit';
import type { Env, Lead, Place, SearchResponse } from './types';

const DEFAULT_NEARBY_RADIUS_METERS = 1500;
const MAX_NEARBY_RADIUS_METERS = 50000; // Places API の上限

/** 開発時のフロントエンド。ALLOWED_ORIGINS 未設定でも動くようにしておく。 */
const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

const app = new Hono<{ Bindings: Env }>();

// --- CORS ---------------------------------------------------------------

app.use(
    '/api/*',
    cors({
        origin: (origin, c) => {
            const configured = c.env.ALLOWED_ORIGINS?.split(',')
                .map((o: string) => o.trim())
                .filter(Boolean);
            const allowed = configured?.length ? configured : DEV_ORIGINS;
            return allowed.includes(origin) ? origin : null;
        },
        allowMethods: ['GET', 'OPTIONS'],
        maxAge: 86400,
    }),
);

// --- レート制限 ---------------------------------------------------------

app.use('/api/*', async (c, next) => {
    const clientId = c.req.header('cf-connecting-ip') ?? 'unknown';
    const result = await checkRateLimit(c.env, clientId);

    if (!result.allowed) {
        return c.json(
            { error: 'リクエストが多すぎます。しばらく経ってから再度お試しください。' },
            429,
            { 'Retry-After': String(result.retryAfterSeconds) },
        );
    }

    c.header('X-RateLimit-Remaining', String(result.remaining));
    await next();
});

// --- ヘルスチェック -----------------------------------------------------

app.get('/health', (c) =>
    c.json({
        status: 'ok',
        environment: c.env.ENVIRONMENT ?? 'unknown',
        // キーそのものは返さない。設定漏れの検知だけできればよい。
        googleApiKeyConfigured: Boolean(c.env.GOOGLE_API_KEY),
        chainList: chainListSize,
    }),
);

// --- 検索 ---------------------------------------------------------------

const searchQuerySchema = z
    .object({
        category: z.string().min(1, 'category は必須です'),
        area: z.string().min(1).optional(),
        lat: z.coerce.number().min(-90).max(90).optional(),
        lng: z.coerce.number().min(-180).max(180).optional(),
        radius: z.coerce
            .number()
            .positive()
            .max(MAX_NEARBY_RADIUS_METERS)
            .default(DEFAULT_NEARBY_RADIUS_METERS),
    })
    .refine((q) => (q.lat != null && q.lng != null) || q.area != null, {
        message: 'area または lat/lng のどちらかが必要です',
    })
    .refine((q) => (q.lat == null) === (q.lng == null), {
        message: 'lat と lng は両方指定してください',
    });

app.get('/api/search', async (c) => {
    if (!c.env.GOOGLE_API_KEY) {
        console.error('missing_google_api_key');
        return c.json({ error: 'サーバー設定エラーです。' }, 500);
    }

    const parsed = searchQuerySchema.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams),
    );

    if (!parsed.success) {
        return c.json(
            {
                error: '検索条件が不正です。',
                details: parsed.error.issues.map((i) => i.message),
            },
            400,
        );
    }

    const { category, area, lat, lng, radius } = parsed.data;
    const hasCoordinates = lat != null && lng != null;

    const searchArgs = hasCoordinates
        ? ({ mode: 'nearby', category, lat, lng, radius } as const)
        : ({ mode: 'text', category, area: area! } as const);

    const cacheKey = buildSearchKey(searchArgs);

    const cached = await readSearchCache(c.env, cacheKey);
    if (cached) {
        return c.json<SearchResponse>({ leads: cached, cached: true });
    }

    try {
        const places = await searchPlaces(c.env, searchArgs);
        const leads = places.filter(keepIndependentCafe).map(toLead(category));

        // キャッシュ書き込みはレスポンスを待たせない。
        c.executionCtx.waitUntil(writeSearchCache(c.env, cacheKey, leads));

        console.log('search_completed', {
            mode: searchArgs.mode,
            category,
            fetched: places.length,
            returned: leads.length,
        });

        return c.json<SearchResponse>({ leads, cached: false });
    } catch (error) {
        if (error instanceof PlacesApiError) {
            return c.json({ error: 'カフェの検索に失敗しました。' }, error.status as 500);
        }
        console.error('search_unexpected_error', { error: String(error) });
        return c.json({ error: 'カフェの検索に失敗しました。' }, 500);
    }
});

/** チェーン店を除外する。ここを通ったものだけがフロントに出る。 */
function keepIndependentCafe(place: Place): boolean {
    return !isChainCafe(place.displayName.text, place.websiteUri);
}

function toLead(category: string) {
    return (place: Place): Lead => ({
        id: place.id,
        name: place.displayName.text,
        address: place.formattedAddress,
        category,
        websiteUri: place.websiteUri,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        openNow: place.regularOpeningHours?.openNow,
        photoName: place.photos?.[0]?.name,
    });
}

// --- 写真プロキシ -------------------------------------------------------

const photoQuerySchema = z.object({
    // 例: places/ChIJxxxx/photos/yyyy
    name: z
        .string()
        .regex(/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/, 'name の形式が不正です'),
    maxWidthPx: z.coerce.number().int().min(1).max(1600).default(400),
    maxHeightPx: z.coerce.number().int().min(1).max(1600).default(400),
});

app.get('/api/photo', async (c) => {
    if (!c.env.GOOGLE_API_KEY) {
        console.error('missing_google_api_key');
        return c.json({ error: 'サーバー設定エラーです。' }, 500);
    }

    const parsed = photoQuerySchema.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams),
    );

    if (!parsed.success) {
        return c.json(
            {
                error: '写真の指定が不正です。',
                details: parsed.error.issues.map((i) => i.message),
            },
            400,
        );
    }

    const { name, maxWidthPx, maxHeightPx } = parsed.data;

    // 同じ写真を何度も Places から取らないようエッジキャッシュを使う。
    const cache = caches.default;
    const cacheKey = new Request(new URL(c.req.url).toString(), { method: 'GET' });

    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    try {
        const upstream = await fetchPhoto(c.env, name, maxWidthPx, maxHeightPx);

        const response = new Response(upstream.body, {
            headers: {
                'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
                // 写真は差し替わらない前提で長めに持つ。
                'Cache-Control': 'public, max-age=604800, immutable',
            },
        });

        c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
    } catch (error) {
        if (error instanceof PlacesApiError) {
            return c.json({ error: '写真の取得に失敗しました。' }, error.status as 500);
        }
        console.error('photo_unexpected_error', { error: String(error) });
        return c.json({ error: '写真の取得に失敗しました。' }, 500);
    }
});

// --- フォールバック -----------------------------------------------------

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
    console.error('unhandled_error', { error: String(error) });
    return c.json({ error: 'サーバーエラーが発生しました。' }, 500);
});

export default app;
