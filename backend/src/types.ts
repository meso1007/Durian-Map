import type { OpeningPeriod } from './opening-hours';

/** Cloudflare Workers の環境バインディング。wrangler.jsonc と対応させること。 */
export type Env = {
    /** 検索結果 / 写真 / 逆ジオコード / 予算カウンタ用の KV。wrangler.jsonc の kv_namespaces で定義。 */
    CACHE: KVNamespace;
    /** 検索系のレート制限（60 秒 30 回）。wrangler.jsonc の ratelimits で定義。 */
    SEARCH_RATE_LIMITER: RateLimit;
    /** 写真のレート制限（60 秒 300 回）。1 検索で 15〜20 枚並ぶので検索より緩い。 */
    PHOTO_RATE_LIMITER: RateLimit;
    /** Google Places API (New) のキー。`wrangler secret put GOOGLE_API_KEY` で設定。 */
    GOOGLE_API_KEY: string;
    /** /api/photo の署名鍵。`wrangler secret put PHOTO_SIGNING_KEY` で設定。 */
    PHOTO_SIGNING_KEY: string;
    /** CORS を許可するオリジン（カンマ区切り）。未設定なら開発用 localhost のみ許可。 */
    ALLOWED_ORIGINS?: string;
    /** 実行環境名。ログの出し分けに使う。 */
    ENVIRONMENT?: string;
    /** 1 日（JST）に Places の検索を呼んでよい上限。超えると 503。 */
    DAILY_SEARCH_BUDGET?: string | number;
    /** 1 日（JST）に Places の写真を取ってよい上限。超えると 503。 */
    DAILY_PHOTO_BUDGET?: string | number;
};

/** Google Places API (New) から受け取る生の place。必要なフィールドのみ定義。 */
export type Place = {
    id: string;
    displayName: { text: string };
    formattedAddress: string;
    primaryType?: string;
    websiteUri?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    userRatingCount?: number;
    regularOpeningHours?: {
        /** Places が応答を作った時刻の値。キャッシュすると嘘になるので使わない。 */
        openNow?: boolean;
        /** 曜日と時刻の開閉ペア。これを保存してレスポンス時に openNow を計算する。 */
        periods?: OpeningPeriod[];
        /** 「月曜日: 8時00分～19時00分」形式の 7 要素。ロケールは API のリクエスト言語に従う。 */
        weekdayDescriptions?: string[];
    };
    nationalPhoneNumber?: string;
    /** PRICE_LEVEL_INEXPENSIVE 〜 PRICE_LEVEL_VERY_EXPENSIVE。取得できない店も多い。 */
    priceLevel?: string;
    photos?: Array<{ name: string }>;
};

/**
 * KV に保存する 1 件分の内部表現。
 *
 * 時刻によって変わる値（openNow / closesAt / opensAt）と、鍵が変われば変わる値
 * （photoSig）は**保存しない**。保存するのは `periods` までで、レスポンスを作る
 * たびに計算する。これで TTL を 7 日に延ばしても営業状態が嘘にならない。
 */
export type CachedCafe = {
    id: string;
    name: string;
    address: string;
    category: string;
    websiteUri?: string;
    lat?: number;
    lng?: number;
    rating?: number;
    userRatingCount?: number;
    /** 曜日別の営業時間（7 要素）。取得できないときは undefined。 */
    weekdayDescriptions?: string[];
    /** 曜日と時刻の開閉ペア。レスポンスには出さない。 */
    periods?: OpeningPeriod[];
    /** 国内向け表記の電話番号。 */
    phone?: string;
    /** 価格帯。フロントの価格フィルタが使う。取得できないときは undefined。 */
    priceLevel?: string;
    /** Places の写真リソース名。表示は /api/photo 経由で行う（API キーを露出させないため）。 */
    photoName?: string;
};

/** フロントエンドに返す 1 件分のカフェ情報。 */
export type Lead = Omit<CachedCafe, 'periods'> & {
    /** 営業中かどうか。レスポンス生成時に JST で計算する。不明なら undefined。 */
    openNow?: boolean;
    /** 営業中のときの閉店時刻。例: "21:00"。 */
    closesAt?: string;
    /** 閉店中のときの次の開店時刻。例: "8:00"。 */
    opensAt?: string;
    /** photoName の HMAC 署名。/api/photo に `sig` として渡す。 */
    photoSig?: string;
};

export type SearchResponse = {
    leads: Lead[];
    /** キャッシュから返したかどうか。デバッグ・監視用。 */
    cached: boolean;
};
