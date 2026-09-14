import type { Env, Place } from './types';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchNearby';

/**
 * 取得するフィールド。増やすと Places の課金ティアが上がるので安易に足さないこと。
 *
 * `regularOpeningHours` は periods / weekdayDescriptions / openNow を**まとめて 1 つの
 * フィールド**として数えるので、periods を受け取っても課金は変わらない。
 */
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
    'places.nationalPhoneNumber',
    'places.priceLevel',
    'places.photos',
].join(',');

/** 上流 API が遅いときに Worker の実行時間を食い潰さないための上限。 */
const UPSTREAM_TIMEOUT_MS = 8000;

/** クライアントに返す HTTP ステータス。`as 500` のような握り潰しを避けるため列挙する。 */
export type PlacesErrorStatus = 404 | 429 | 500 | 502 | 504;

/** 上流 API 由来のエラー。HTTP ステータスをそのまま伝播させるために使う。 */
export class PlacesApiError extends Error {
    constructor(
        message: string,
        readonly status: PlacesErrorStatus,
        readonly upstreamStatus?: number,
    ) {
        super(message);
        this.name = 'PlacesApiError';
    }
}

/** 上流のステータスをクライアントに返すステータスへ写す。 */
function toClientStatus(upstreamStatus: number): PlacesErrorStatus {
    // 認証・課金の失敗はこちらの設定ミス。
    if (upstreamStatus === 401 || upstreamStatus === 403) return 500;
    // 429 は潰さずそのまま返す。潰すとフロントがバックオフできない。
    if (upstreamStatus === 429) return 429;
    if (upstreamStatus === 404) return 404;
    return 502;
}

/**
 * Places API を呼ぶ共通処理。タイムアウトとエラー変換をここに集約する。
 *
 * エンドポイントごとに fetch をコピペしていたので、3 つ目を足すと 3 重化していた。
 */
export async function callPlacesApi(
    url: string | URL,
    init: RequestInit,
    label: string,
): Promise<Response> {
    let response: Response;
    try {
        response = await fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch (error) {
        const timedOut = error instanceof Error && error.name === 'TimeoutError';
        throw new PlacesApiError(
            timedOut ? `${label} timed out` : `Failed to reach ${label}`,
            504,
        );
    }

    // redirect: 'manual' を頼んだ呼び出し側にとって 3xx は想定内の結果。
    if (init.redirect === 'manual' && response.status >= 300 && response.status < 400) {
        return response;
    }

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('places_api_error', {
            label,
            status: response.status,
            detail: detail.slice(0, 500),
        });
        throw new PlacesApiError(
            `${label} returned an error`,
            toClientStatus(response.status),
            response.status,
        );
    }

    return response;
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

    const response = await callPlacesApi(
        url,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': env.GOOGLE_API_KEY,
                'X-Goog-FieldMask': FIELD_MASK,
            },
            body: JSON.stringify(body),
        },
        'Places search',
    );

    const data = (await response.json()) as { places?: Place[] };
    return data.places ?? [];
}

/**
 * Places の写真バイナリを取得する。
 * API キーをクライアントに出さないため、必ず Worker 側で叩く。
 *
 * キーは**ヘッダ**で送る。クエリに載せると上流のアクセスログや中間のキャッシュに
 * キーごと残る。
 *
 * この API は実体（lh3.googleusercontent.com など）へ 302 で飛ばす。
 * `redirect: 'follow'` にするとカスタムヘッダはリダイレクト先にも送られるので、
 * **キーを載せたまま別ホストへ行かないよう** リダイレクトは自分で辿る。
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

    const response = await callPlacesApi(
        url,
        {
            redirect: 'manual',
            headers: { 'X-Goog-Api-Key': env.GOOGLE_API_KEY },
        },
        'Places photo',
    );

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('Location');
    // https 以外へは追わない（リダイレクト先を使った内部宛先へのアクセスを防ぐ）。
    if (!location || !location.startsWith('https://')) {
        throw new PlacesApiError('Places photo returned an unusable redirect', 502);
    }

    // 2 度目はキーを付けない。実体は署名付き URL なので認証は要らない。
    return callPlacesApi(location, { redirect: 'follow' }, 'Places photo redirect');
}
