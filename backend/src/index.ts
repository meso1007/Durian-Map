import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { incrementBudget, isBudgetExceeded, parseBudget } from './budget';
import { buildSearchKey, readSearchCache, writeSearchCache } from './cache';
import { chainListSize, isChainCafe } from './chains';
import { computeOpeningStatus } from './opening-hours';
import {
    DEFAULT_PHOTO_SIZE,
    PHOTO_NAME_PATTERN,
    buildPhotoCacheKey,
    signPhotoName,
    snapPhotoSize,
    verifyPhotoSignature,
} from './photo';
import { PlacesApiError, fetchPhoto, searchPlaces } from './places';
import { rateLimitKey } from './ratelimit';
import { reverseGeocode } from './reverse-geocode';
import type { CachedCafe, Env, Lead, Place, SearchResponse } from './types';

/** 対応カテゴリ。自由文字列を通すと Enterprise ティアの検索を第三者に実行させられる。 */
const CATEGORIES = ['カフェ'] as const;

const DEFAULT_NEARBY_RADIUS_METERS = 1500;
const MAX_NEARBY_RADIUS_METERS = 50000; // Places API の上限

/**
 * 受け付ける半径。1m 刻みを許すとキャッシュキーが実質無限に増えてヒット率が出ない。
 * 近い値に寄せる。
 */
const RADIUS_CHOICES = [500, 1000, 1500, 3000, 5000];

/** 予算ブレーカの既定値。wrangler.jsonc の vars で上書きする。 */
const FALLBACK_DAILY_SEARCH_BUDGET = 300;
const FALLBACK_DAILY_PHOTO_BUDGET = 3000;

/** 写真バイナリの保持期間。Places のキャッシュ規約の上限が 30 日。 */
const PHOTO_TTL_SECONDS = 60 * 60 * 24 * 30;

/** 開発時のフロントエンド。ALLOWED_ORIGINS 未設定でも動くようにしておく。 */
const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/**
 * ネイティブアプリ（Capacitor の WebView）の Origin。
 *
 * これは環境ごとに変わる値ではなく iOS アプリそのものの Origin なので、
 * ALLOWED_ORIGINS（環境変数）ではなくここに置いて**常に許可**する。
 * 環境変数に入れていた頃は、別ブランチが ALLOWED_ORIGINS を編集してデプロイする
 * たびに消えて iOS アプリの検索が落ちていた。→ tasks/lessons.md
 */
const NATIVE_APP_ORIGINS = ['capacitor://localhost'];

type AppEnv = { Bindings: Env; Variables: { requestId: string } };
type AppContext = Context<AppEnv>;

const app = new Hono<AppEnv>();

// --- 共通ヘルパ ---------------------------------------------------------

/**
 * レスポンスを待たせずに後処理を走らせる。
 *
 * 失敗はここで必ず握ってログに出す。誰も await しない Promise なので、
 * reject を放置すると**キャッシュ書き込みの失敗に気づけない**（unhandled rejection
 * にもなる）。`c.executionCtx` は ExecutionContext が無い環境では throw するので、
 * その場合はそのまま走らせる。
 */
function runAfterResponse(c: AppContext, label: string, promise: Promise<unknown>): void {
    const guarded = promise.catch((error: unknown) => {
        console.error('after_response_failed', {
            label,
            requestId: c.get('requestId'),
            error: String(error),
        });
    });

    try {
        c.executionCtx.waitUntil(guarded);
    } catch {
        void guarded;
    }
}

/** ログに載せるユーザー入力。制御文字を落として 64 文字で切る。 */
function sanitizeForLog(value: string): string {
    return value.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 64);
}

/** エラーレスポンス。requestId を必ず載せてログと突き合わせられるようにする。 */
function fail(
    c: AppContext,
    message: string,
    status: 400 | 403 | 404 | 429 | 500 | 502 | 503 | 504,
    extra?: Record<string, unknown>,
    headers?: Record<string, string>,
) {
    return c.json({ error: message, requestId: c.get('requestId'), ...extra }, status, headers);
}

/**
 * API キーが実際に使える状態かを判定する。
 *
 * `wrangler secret put` に空入力すると secret 自体は存在するのに値が空、
 * という状態になり得るので、存在チェックだけでは足りない。
 */
function isConfigured(value: string | undefined): boolean {
    return (value ?? '').trim().length > 0;
}

// --- リクエスト ID ------------------------------------------------------

app.use('*', async (c, next) => {
    c.set('requestId', c.req.header('cf-ray') ?? crypto.randomUUID());
    await next();
});

// --- CORS ---------------------------------------------------------------

app.use(
    '/api/*',
    cors({
        origin: (origin, c) => {
            const configured = c.env.ALLOWED_ORIGINS?.split(',')
                .map((o: string) => o.trim())
                .filter(Boolean);
            const configuredOrDev = configured?.length ? configured : DEV_ORIGINS;
            const allowed = [...configuredOrDev, ...NATIVE_APP_ORIGINS];
            return allowed.includes(origin) ? origin : null;
        },
        allowMethods: ['GET', 'HEAD', 'OPTIONS'],
        maxAge: 86400,
    }),
);

// --- レート制限 ---------------------------------------------------------

/**
 * Rate Limiting binding で制限する。/health も検索側に入れる（無料の疎通確認を
 * 無制限に叩かれないように）。写真は 1 検索で 15〜20 枚並ぶので別枠。
 */
app.use('*', async (c, next) => {
    const limiter =
        c.req.path === '/api/photo' ? c.env.PHOTO_RATE_LIMITER : c.env.SEARCH_RATE_LIMITER;
    const key = rateLimitKey(c.req.raw.headers);

    // binding 未設定（ローカル実行）やヘッダ欠落時は素通しする。
    // ここで固定キーに寄せると、全員が 1 つのバケツを共有してしまう。
    if (!limiter || !key) return next();

    const { success } = await limiter.limit({ key });
    if (!success) {
        return fail(
            c,
            'リクエストが多すぎます。しばらく経ってから再度お試しください。',
            429,
            undefined,
            { 'Retry-After': '60' },
        );
    }

    return next();
});

// --- ヘルスチェック -----------------------------------------------------

app.get('/health', (c) =>
    c.json({
        status: 'ok',
        environment: c.env.ENVIRONMENT ?? 'unknown',
        // キーそのものは返さない。設定漏れの検知だけできればよい。
        googleApiKeyConfigured: isConfigured(c.env.GOOGLE_API_KEY),
        // 空の secret が保存されていても気づけるように、こちらも値の有無で見る。
        photoSigningConfigured: isConfigured(c.env.PHOTO_SIGNING_KEY),
        chainList: chainListSize,
    }),
);

// --- 検索 ---------------------------------------------------------------

/** `?lat=&lng=` のような空文字は「未指定」として扱う（0 に coerce させない）。 */
const emptyToUndefined = (value: unknown) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value;

/** 半径を選択肢のうち最も近い値へ寄せる。 */
export function snapRadius(value: number): number {
    return RADIUS_CHOICES.reduce((best, choice) =>
        Math.abs(choice - value) < Math.abs(best - value) ? choice : best,
    );
}

/** 座標は 3 桁（約 110m）に丸める。これ以上細かいとキャッシュに当たらない。 */
function round3(value: number): number {
    return Math.round(value * 1000) / 1000;
}

const searchQuerySchema = z
    .object({
        category: z.preprocess(
            emptyToUndefined,
            z.enum(CATEGORIES, {
                errorMap: () => ({ message: 'category は「カフェ」のみ対応しています' }),
            }),
        ),
        area: z.preprocess(
            emptyToUndefined,
            z
                .string()
                .transform((value) => value.normalize('NFKC').trim())
                .refine((value) => value.length >= 1 && value.length <= 40, {
                    message: 'area は 1〜40 文字で指定してください',
                })
                .optional(),
        ),
        lat: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90).optional()),
        lng: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180).optional()),
        radius: z
            .preprocess(
                emptyToUndefined,
                z.coerce.number().positive().max(MAX_NEARBY_RADIUS_METERS).optional(),
            )
            .transform((value) => snapRadius(value ?? DEFAULT_NEARBY_RADIUS_METERS)),
    })
    .refine((q) => (q.lat != null && q.lng != null) || q.area != null, {
        message: 'area または lat/lng のどちらかが必要です',
    })
    .refine((q) => (q.lat == null) === (q.lng == null), {
        message: 'lat と lng は両方指定してください',
    });

app.get('/api/search', async (c) => {
    if (!isConfigured(c.env.GOOGLE_API_KEY)) {
        console.error('missing_google_api_key', { requestId: c.get('requestId') });
        return fail(c, 'サーバー設定エラーです。', 500);
    }

    const parsed = searchQuerySchema.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams),
    );

    if (!parsed.success) {
        return fail(c, '検索条件が不正です。', 400, {
            details: parsed.error.issues.map((i) => i.message),
        });
    }

    const { category, area, radius } = parsed.data;
    const hasCoordinates = parsed.data.lat != null && parsed.data.lng != null;

    const searchArgs = hasCoordinates
        ? ({
              mode: 'nearby',
              category,
              lat: round3(parsed.data.lat!),
              lng: round3(parsed.data.lng!),
              radius,
          } as const)
        : ({ mode: 'text', category, area: area! } as const);

    const cacheKey = await buildSearchKey(searchArgs);

    const cached = await readSearchCache(c.env, cacheKey);
    if (cached) {
        return c.json<SearchResponse>({ leads: await toLeads(c.env, cached), cached: true });
    }

    const budgetLimit = parseBudget(c.env.DAILY_SEARCH_BUDGET, FALLBACK_DAILY_SEARCH_BUDGET);
    if (await isBudgetExceeded(c.env.CACHE, 'search', budgetLimit)) {
        console.warn('search_budget_exceeded', {
            requestId: c.get('requestId'),
            limit: budgetLimit,
        });
        return fail(c, '本日の検索上限に達しました。明日またお試しください。', 503);
    }

    try {
        const places = await searchPlaces(c.env, searchArgs);
        const cafes = places.filter(keepIndependentCafe).map(toCachedCafe(category));

        runAfterResponse(c, 'budget_search', incrementBudget(c.env.CACHE, 'search'));

        // キャッシュ書き込みはレスポンスを待たせない。
        runAfterResponse(c, 'search_cache_write', writeSearchCache(c.env, cacheKey, cafes));

        console.log('search_completed', {
            requestId: c.get('requestId'),
            mode: searchArgs.mode,
            category,
            area: searchArgs.mode === 'text' ? sanitizeForLog(searchArgs.area) : undefined,
            fetched: places.length,
            returned: cafes.length,
        });

        return c.json<SearchResponse>({ leads: await toLeads(c.env, cafes), cached: false });
    } catch (error) {
        return handleUpstreamError(c, error, 'カフェの検索に失敗しました。');
    }
});

/** チェーン店を除外する。ここを通ったものだけがフロントに出る。 */
function keepIndependentCafe(place: Place): boolean {
    return !isChainCafe(place.displayName.text, place.websiteUri);
}

function toCachedCafe(category: string) {
    return (place: Place): CachedCafe => ({
        id: place.id,
        name: place.displayName.text,
        address: place.formattedAddress,
        category,
        websiteUri: place.websiteUri,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        weekdayDescriptions: place.regularOpeningHours?.weekdayDescriptions,
        periods: place.regularOpeningHours?.periods,
        phone: place.nationalPhoneNumber,
        priceLevel: place.priceLevel,
        photoName: place.photos?.[0]?.name,
    });
}

/**
 * 内部表現をレスポンスに変換する。
 *
 * 営業状態は**ここで**計算する。Places の openNow をそのままキャッシュすると
 * TTL のあいだ嘘をつき続けるため。periods はレスポンスには出さない。
 */
async function toLeads(env: Env, cafes: CachedCafe[]): Promise<Lead[]> {
    const now = new Date();
    const signingKey = isConfigured(env.PHOTO_SIGNING_KEY) ? env.PHOTO_SIGNING_KEY : null;

    return Promise.all(
        cafes.map(async ({ periods, ...rest }) => ({
            ...rest,
            ...computeOpeningStatus(periods, now),
            photoSig:
                signingKey && rest.photoName
                    ? await signPhotoName(signingKey, rest.photoName)
                    : undefined,
        })),
    );
}

// --- 逆ジオコード -------------------------------------------------------

const reverseGeocodeQuerySchema = z.object({
    lat: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90)),
    lng: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180)),
});

app.get('/api/reverse-geocode', async (c) => {
    const parsed = reverseGeocodeQuerySchema.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams),
    );

    if (!parsed.success) {
        return fail(c, '座標の指定が不正です。', 400, {
            details: parsed.error.issues.map((i) => i.message),
        });
    }

    // 座標は 3 桁に丸めてから外部へ送る。必要以上に細かい位置を第三者に渡さない。
    const area = await reverseGeocode(
        c.env,
        round3(parsed.data.lat),
        round3(parsed.data.lng),
    );

    return c.json({ area });
});

// --- 写真プロキシ -------------------------------------------------------

const photoQuerySchema = z.object({
    // 例: places/ChIJxxxx/photos/yyyy。ここが SSRF に対する唯一の防御線。
    // 長さも制限する。name はハッシュ化せず KV のキーに使うので、
    // 上限が無いとキー 512B を超えて写真キャッシュが静かに効かなくなる。
    // 実際の写真リソース名は 500 文字近くある。上限は暴走入力を弾くためのもので、
    // KV キーの長さは buildPhotoCacheKey のハッシュ化で担保している。
    name: z
        .string()
        .max(512, 'name が長すぎます')
        .regex(PHOTO_NAME_PATTERN, 'name の形式が不正です'),
    // 検索レスポンスで配った photoSig。これが無いと任意の写真を取れてしまう。
    sig: z.string().regex(/^[0-9a-f]{64}$/i, 'sig の形式が不正です'),
    maxWidthPx: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    maxHeightPx: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
});

/**
 * 画像以外（エラーページなど）をそのまま中継しないための確認。
 *
 * SVG はスクリプトを埋め込めるので除く。店舗写真が SVG で返ることはない。
 */
function isImageContentType(contentType: string | null): boolean {
    const value = (contentType ?? '').toLowerCase();
    return value.startsWith('image/') && !value.startsWith('image/svg');
}

function photoResponseHeaders(contentType: string): Headers {
    return new Headers({
        'Content-Type': contentType,
        // 写真は差し替わらない前提で長めに持つ。
        'Cache-Control': 'public, max-age=604800, immutable',
        // 画像として配るものが他の型として解釈されないようにする。
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
    });
}

app.get('/api/photo', async (c) => {
    if (!isConfigured(c.env.GOOGLE_API_KEY) || !isConfigured(c.env.PHOTO_SIGNING_KEY)) {
        console.error('missing_photo_secret', {
            requestId: c.get('requestId'),
            googleApiKey: isConfigured(c.env.GOOGLE_API_KEY),
            photoSigningKey: isConfigured(c.env.PHOTO_SIGNING_KEY),
        });
        return fail(c, 'サーバー設定エラーです。', 500);
    }

    const parsed = photoQuerySchema.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams),
    );

    if (!parsed.success) {
        return fail(c, '写真の指定が不正です。', 400, {
            details: parsed.error.issues.map((i) => i.message),
        });
    }

    const { name, sig } = parsed.data;

    if (!(await verifyPhotoSignature(c.env.PHOTO_SIGNING_KEY, name, sig))) {
        return fail(c, '写真の署名が不正です。', 403);
    }

    // サイズは列挙に寄せる。任意値を許すと同じ写真を 256 万通りの URL で取れてしまい、
    // キャッシュが当たらないまま 1 枚ごとに課金される。
    const maxWidthPx = snapPhotoSize(parsed.data.maxWidthPx ?? DEFAULT_PHOTO_SIZE);
    const maxHeightPx = snapPhotoSize(parsed.data.maxHeightPx ?? DEFAULT_PHOTO_SIZE);

    // 1 段目: エッジキャッシュ（コロ単位・追い出しあり）。キーは正規化後の値で作り直す。
    const cache = caches.default;
    const normalizedUrl = new URL(c.req.url);
    normalizedUrl.search = new URLSearchParams({
        name,
        maxWidthPx: String(maxWidthPx),
        maxHeightPx: String(maxHeightPx),
    }).toString();
    const edgeCacheKey = new Request(normalizedUrl.toString(), { method: 'GET' });

    const edgeHit = await cache.match(edgeCacheKey);
    if (edgeHit) return edgeHit;

    // 2 段目: KV（全コロ共有・30 日）。写真代が費用の 9 割を占めるのでここが効く。
    const kvKey = await buildPhotoCacheKey(name, maxWidthPx, maxHeightPx);
    const cached = await readPhotoCache(c.env, kvKey);
    if (cached) {
        const response = new Response(cached.body, {
            headers: photoResponseHeaders(cached.contentType),
        });
        runAfterResponse(c, 'photo_edge_cache_put', cache.put(edgeCacheKey, response.clone()));
        return response;
    }

    const budgetLimit = parseBudget(c.env.DAILY_PHOTO_BUDGET, FALLBACK_DAILY_PHOTO_BUDGET);
    if (await isBudgetExceeded(c.env.CACHE, 'photo', budgetLimit)) {
        console.warn('photo_budget_exceeded', {
            requestId: c.get('requestId'),
            limit: budgetLimit,
        });
        // 画像の取得先なので本文は返さない。
        return c.body(null, 503);
    }

    try {
        const upstream = await fetchPhoto(c.env, name, maxWidthPx, maxHeightPx);
        runAfterResponse(c, 'budget_photo', incrementBudget(c.env.CACHE, 'photo'));

        const contentType = upstream.headers.get('Content-Type');
        if (!isImageContentType(contentType)) {
            console.error('photo_unexpected_content_type', {
                requestId: c.get('requestId'),
                contentType: sanitizeForLog(contentType ?? ''),
            });
            return fail(c, '写真の取得に失敗しました。', 502);
        }

        const body = await upstream.arrayBuffer();
        const headers = photoResponseHeaders(contentType!);

        runAfterResponse(
            c,
            'photo_edge_cache_put',
            cache.put(edgeCacheKey, new Response(body, { headers })),
        );
        runAfterResponse(
            c,
            'photo_cache_write',
            writePhotoCache(c.env, kvKey, body, contentType!),
        );

        return new Response(body, { headers });
    } catch (error) {
        return handleUpstreamError(c, error, '写真の取得に失敗しました。');
    }
});

type CachedPhoto = { body: ArrayBuffer; contentType: string };

async function readPhotoCache(env: Env, key: string): Promise<CachedPhoto | null> {
    try {
        const { value, metadata } = await env.CACHE.getWithMetadata<{ contentType?: string }>(
            key,
            'arrayBuffer',
        );
        if (!value) return null;
        return { body: value, contentType: metadata?.contentType ?? 'image/jpeg' };
    } catch (error) {
        console.error('photo_cache_read_failed', { key, error: String(error) });
        return null;
    }
}

async function writePhotoCache(
    env: Env,
    key: string,
    body: ArrayBuffer,
    contentType: string,
): Promise<void> {
    try {
        await env.CACHE.put(key, body, {
            expirationTtl: PHOTO_TTL_SECONDS,
            // Content-Type は値と一緒に持てないので metadata に置く。
            metadata: { contentType },
        });
    } catch (error) {
        console.error('photo_cache_write_failed', { key, error: String(error) });
    }
}

// --- エラー -------------------------------------------------------------

/** 上流由来のエラーをクライアント向けのレスポンスにする。 */
function handleUpstreamError(c: AppContext, error: unknown, message: string) {
    if (error instanceof PlacesApiError) {
        // 429 はそのまま返す。潰すとフロントがバックオフできない。
        const headers = error.status === 429 ? { 'Retry-After': '30' } : undefined;
        return fail(c, message, error.status, undefined, headers);
    }

    console.error('unexpected_upstream_error', {
        requestId: c.get('requestId'),
        error: String(error),
    });
    return fail(c, message, 500);
}

app.notFound((c) => c.json({ error: 'Not found', requestId: c.get('requestId') }, 404));

app.onError((error, c) => {
    console.error('unhandled_error', {
        requestId: c.get('requestId'),
        error: String(error),
    });
    return c.json(
        { error: 'サーバーエラーが発生しました。', requestId: c.get('requestId') },
        500,
    );
});

export default app;
