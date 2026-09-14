/** Cloudflare Workers の環境バインディング。wrangler.jsonc と対応させること。 */
export type Env = {
    /** 検索結果キャッシュ用の KV。wrangler.jsonc の kv_namespaces で定義。 */
    CACHE: KVNamespace;
    /** Google Places API (New) のキー。`wrangler secret put GOOGLE_API_KEY` で設定。 */
    GOOGLE_API_KEY: string;
    /** CORS を許可するオリジン（カンマ区切り）。未設定なら開発用 localhost のみ許可。 */
    ALLOWED_ORIGINS?: string;
    /** 実行環境名。ログの出し分けに使う。 */
    ENVIRONMENT?: string;
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
    regularOpeningHours?: { openNow: boolean };
    photos?: Array<{ name: string }>;
};

/** フロントエンドに返す 1 件分のカフェ情報。 */
export type Lead = {
    id: string;
    name: string;
    address: string;
    category: string;
    websiteUri?: string;
    lat?: number;
    lng?: number;
    rating?: number;
    userRatingCount?: number;
    openNow?: boolean;
    /** Places の写真リソース名。表示は /api/photo 経由で行う（API キーを露出させないため）。 */
    photoName?: string;
};

export type SearchResponse = {
    leads: Lead[];
    /** キャッシュから返したかどうか。デバッグ・監視用。 */
    cached: boolean;
};
