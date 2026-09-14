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
    openNow?: boolean;
    /** 曜日別の営業時間（7 要素・日本語）。取得できないときは undefined。 */
    weekdayDescriptions?: string[];
    /** 国内向け表記の電話番号。 */
    phone?: string;
    /** Places の写真リソース名。表示は getCafePhotoUrl() を通す。 */
    photoName?: string;
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

type SearchParams =
    | { category: string; area: string }
    | { category: string; location: Coordinates; radius?: number };

/**
 * カフェを検索する。チェーン店の除外は API 側で済んでいる。
 */
export async function searchCafes(params: SearchParams): Promise<Cafe[]> {
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
        response = await fetch(`${getBaseUrl()}/api/search?${query}`);
    } catch {
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
    cafe: Pick<Cafe, 'photoName'>,
    size = 400,
): string | null {
    const base = findBaseUrl();

    // 描画中に呼ばれるので、設定漏れでも画面を落とさず「写真なし」に倒す。
    if (!cafe.photoName || !base) return null;

    const query = new URLSearchParams({
        name: cafe.photoName,
        maxWidthPx: String(size),
        maxHeightPx: String(size),
    });

    return `${base}/api/photo?${query}`;
}
