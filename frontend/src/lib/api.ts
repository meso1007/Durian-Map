/**
 * 検索 API クライアント。
 *
 * API の実体は Cloudflare Workers（`backend/`）にある。
 * fetch をここに集約しておくことで、iOS（Capacitor）から使うときも
 * ベース URL を差し替えるだけで済む。→ docs/platform-strategy.md
 *
 * UI コンポーネントから直接 fetch しないこと。
 */

export type Cafe = {
    id: string;
    name: string;
    address: string;
    category?: string;
    websiteUri?: string;
    lat?: number;
    lng?: number;
    rating?: number;
    userRatingCount?: number;
    /** サーバーがレスポンス時に JST で計算した営業状態。キャッシュされた値ではない。 */
    openNow?: boolean;
    /** 営業中のときの今日の閉店時刻（"21:00"）。 */
    closesAt?: string;
    /** 閉店中のときの次の開店時刻（"8:00"）。 */
    opensAt?: string;
    /** 曜日別の営業時間（7 要素・日本語）。取得できないときは undefined。 */
    weekdayDescriptions?: string[];
    /** 国内向け表記の電話番号。 */
    phone?: string;
    /** PRICE_LEVEL_INEXPENSIVE 〜 PRICE_LEVEL_VERY_EXPENSIVE。価格フィルタが使う。 */
    priceLevel?: string;
    /** Places の写真リソース名。表示は getCafePhotoUrl() を通す。 */
    photoName?: string;
    /**
     * 写真 URL の署名。サーバーが photoName とサイズに対して発行する。
     * これが無いと /api/photo は 403 を返すので、写真は出せない。
     */
    photoSig?: string;
};

export type Coordinates = {
    lat: number;
    lng: number;
};

/** 呼び出し側が message をそのままユーザーに見せられるエラー。 */
export class ApiError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = 'ApiError';
    }
}

/** 未設定なら null。呼び出し側が握りつぶすか投げるかを決める。 */
function findBaseUrl(): string | null {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    return base ? base.replace(/\/$/, '') : null;
}

function getBaseUrl(): string {
    const base = findBaseUrl();

    if (!base) {
        // 設定漏れは黙って壊れるより早く気づけたほうがよい。
        throw new ApiError(
            'NEXT_PUBLIC_API_BASE_URL が未設定です。frontend/.env.local を確認してください。',
        );
    }

    return base;
}

/**
 * 写真の要求サイズ。サーバーはこの 3 つしか受け付けない
 * （任意サイズを許すとキャッシュキーが無数に増え、Places の写真課金が効かなくなる）。
 */
export type PhotoSize = 200 | 400 | 800;

type SearchParams =
    | { category: string; area: string }
    | { category: string; location: Coordinates; radius?: number };

/**
 * カフェを検索する。チェーン店の除外は API 側で済んでいる。
 */
export async function searchCafes(params: SearchParams, signal?: AbortSignal): Promise<Cafe[]> {
    const query = new URLSearchParams({ category: params.category });

    if ('area' in params) {
        query.set('area', params.area);
    } else {
        query.set('lat', String(params.location.lat));
        query.set('lng', String(params.location.lng));
        if (params.radius != null) query.set('radius', String(params.radius));
    }

    let response: Response;
    try {
        response = await fetch(`${getBaseUrl()}/api/search?${query}`, { signal });
    } catch (error) {
        // 中断は呼び出し側が世代で判定するので、そのまま投げ直す。
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError('ネットワークに接続できませんでした。通信環境をご確認ください。');
    }

    if (response.status === 429) {
        throw new ApiError('検索の回数が上限に達しました。少し待ってから再度お試しください。', 429);
    }

    const data = (await response.json().catch(() => null)) as
        | { leads?: Cafe[]; error?: string }
        | null;

    if (!response.ok || !data) {
        throw new ApiError(
            data?.error ?? 'カフェの検索に失敗しました。しばらく経ってから再度お試しください。',
            response.status,
        );
    }

    return data.leads ?? [];
}

/**
 * カフェの写真 URL を返す。
 *
 * Worker のプロキシ経由にすることで Google API キーをクライアントに露出させない。
 * 写真がない場合は null。
 */
export function getCafePhotoUrl(
    cafe: Pick<Cafe, 'photoName' | 'photoSig'>,
    size: PhotoSize = 400,
): string | null {
    const base = findBaseUrl();

    // 描画中に呼ばれるので、設定漏れでも画面を落とさず「写真なし」に倒す。
    // 署名が無い場合も同じ（サーバーが 403 を返すため、壊れた画像より無いほうがよい）。
    if (!cafe.photoName || !cafe.photoSig || !base) return null;

    const query = new URLSearchParams({
        name: cafe.photoName,
        sig: cafe.photoSig,
        maxWidthPx: String(size),
        maxHeightPx: String(size),
    });

    return `${base}/api/photo?${query}`;
}

/**
 * 座標から地名を引く（Worker の /api/reverse-geocode 経由）。
 *
 * ブラウザから Nominatim を直接叩かないこと。User-Agent を付けられず利用規約に反する上、
 * ユーザーの座標が第三者へ直接渡ってしまう。
 * 失敗時は例外にせず null を返す — 地名は「あると嬉しい」情報でしかないため。
 */
export async function reverseGeocode(
    coordinates: Coordinates,
    signal?: AbortSignal,
): Promise<string | null> {
    const base = findBaseUrl();
    if (!base) return null;

    const query = new URLSearchParams({
        lat: String(coordinates.lat),
        lng: String(coordinates.lng),
    });

    try {
        const response = await fetch(`${base}/api/reverse-geocode?${query}`, { signal });
        if (!response.ok) return null;

        const data = (await response.json()) as { area?: string | null };
        return data.area ?? null;
    } catch {
        return null;
    }
}
