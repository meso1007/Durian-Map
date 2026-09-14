import type { Env, Place } from './types';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchNearby';

/** 取得するフィールド。増やすと Places の課金ティアが上がるので安易に足さないこと。 */
const FIELD_MASK = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.primaryType',
    'places.websiteUri',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.regularOpeningHours',
    'places.photos',
].join(',');

/** 上流 API が遅いときに Worker の実行時間を食い潰さないための上限。 */
const UPSTREAM_TIMEOUT_MS = 8000;

/** 上流 API 由来のエラー。HTTP ステータスをそのまま伝播させるために使う。 */
export class PlacesApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly upstreamStatus?: number,
    ) {
        super(message);
        this.name = 'PlacesApiError';
    }
}

/**
 * カテゴリを Places の type に対応づける。
 * 対応がない場合は null を返し、呼び出し側はテキスト検索にフォールバックする。
 */
export function getNearbySearchTypes(category: string): string[] | null {
    switch (category) {
        case 'カフェ':
            return ['cafe', 'coffee_shop'];
        default:
            return null;
    }
}

type SearchArgs =
    | { mode: 'nearby'; category: string; lat: number; lng: number; radius: number }
    | { mode: 'text'; category: string; area: string };

/** Places API (New) を呼び、place の配列を返す。 */
export async function searchPlaces(env: Env, args: SearchArgs): Promise<Place[]> {
    const nearbyTypes = args.mode === 'nearby' ? getNearbySearchTypes(args.category) : null;
    const useNearby = args.mode === 'nearby' && nearbyTypes !== null;

    const url = useNearby ? NEARBY_SEARCH_URL : TEXT_SEARCH_URL;

    const body =
        useNearby && args.mode === 'nearby'
            ? {
                  includedTypes: nearbyTypes,
                  maxResultCount: 20,
                  rankPreference: 'DISTANCE',
                  languageCode: 'ja',
                  regionCode: 'JP',
                  locationRestriction: {
                      circle: {
                          center: { latitude: args.lat, longitude: args.lng },
                          radius: args.radius,
                      },
                  },
              }
            : {
                  // nearby 指定でも type 対応がない場合はここに落ちる。
                  textQuery:
                      args.mode === 'text'
                          ? `${args.area} ${args.category}`
                          : args.category,
                  languageCode: 'ja',
                  regionCode: 'JP',
              };

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': env.GOOGLE_API_KEY,
                'X-Goog-FieldMask': FIELD_MASK,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
    } catch (error) {
        const timedOut = error instanceof Error && error.name === 'TimeoutError';
        throw new PlacesApiError(
            timedOut ? 'Places API timed out' : 'Failed to reach Places API',
            504,
        );
    }

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('places_api_error', {
            status: response.status,
            detail: detail.slice(0, 500),
        });

        // 認証・課金の失敗はこちらの設定ミスなので 500、それ以外は 502 として扱う。
        const status = response.status === 401 || response.status === 403 ? 500 : 502;
        throw new PlacesApiError('Places API returned an error', status, response.status);
    }

    const data = (await response.json()) as { places?: Place[] };
    return data.places ?? [];
}

/**
 * Places の写真バイナリを取得する。
 * API キーをクライアントに出さないため、必ず Worker 側で叩く。
 */
export async function fetchPhoto(
    env: Env,
    photoName: string,
    maxWidthPx: number,
    maxHeightPx: number,
): Promise<Response> {
    const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
    url.searchParams.set('maxWidthPx', String(maxWidthPx));
    url.searchParams.set('maxHeightPx', String(maxHeightPx));
    url.searchParams.set('key', env.GOOGLE_API_KEY);

    let response: Response;
    try {
        response = await fetch(url, {
            redirect: 'follow',
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
    } catch {
        throw new PlacesApiError('Failed to reach Places photo endpoint', 504);
    }

    if (!response.ok) {
        throw new PlacesApiError(
            'Places photo endpoint returned an error',
            response.status === 404 ? 404 : 502,
            response.status,
        );
    }

    return response;
}
