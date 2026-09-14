/**
 * カフェ 1 件の表示に関する純関数。
 *
 * 画面から切り出してあるのは、ここが「Places の生データを日本語の表示に直す」層で、
 * UI の都合とは独立にテストできるようにしておきたいため。
 */

import type { Cafe } from './api';

/** Places の primaryType（内部識別子）→ 日本語ラベル。未知の型は出さない。 */
const CATEGORY_LABELS: Record<string, string> = {
    cafe: 'カフェ',
    coffee_shop: 'コーヒーショップ',
    tea_house: '日本茶・紅茶専門店',
    bakery: 'ベーカリー',
    dessert_shop: 'デザート・スイーツ',
    ice_cream_shop: 'アイスクリーム',
    sandwich_shop: 'サンドイッチ',
    breakfast_restaurant: 'モーニング',
    brunch_restaurant: 'ブランチ',
    juice_shop: 'ジューススタンド',
    bar: 'バー',
    restaurant: 'レストラン',
    food_store: '食料品店',
    store: 'ショップ',
};

export function getCategoryLabel(category?: string): string | null {
    return (category && CATEGORY_LABELS[category]) ?? null;
}

/**
 * 価格帯フィルタ。Places の priceLevel を 3 段にまとめる。
 * 金額の目安はカフェ 1 人あたり。Places 側は絶対額を返さないのでこちらで言い換える。
 */
export const PRICE_FILTERS = [
    { id: 'cheap', label: '〜¥1,000', levels: ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_FREE'] },
    { id: 'mid', label: '¥1,000〜2,000', levels: ['PRICE_LEVEL_MODERATE'] },
    { id: 'high', label: '¥2,000〜', levels: ['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'] },
] as const;

export type PriceFilterId = (typeof PRICE_FILTERS)[number]['id'];

/** 価格フィルタに合致するか。フィルタ未選択なら全件通す。 */
export function matchesPriceFilters(cafe: Cafe, selected: readonly PriceFilterId[]): boolean {
    if (selected.length === 0) return true;

    // priceLevel が取れない店を隠すと結果がごっそり消えるので、絞り込みの対象外にする。
    if (!cafe.priceLevel) return false;

    return selected.some((id) =>
        PRICE_FILTERS.find((filter) => filter.id === id)?.levels.some((level) => level === cafe.priceLevel),
    );
}

/** Google マップで開く URL。店名は必ずエスケープする。 */
export function getCafeMapUrl(cafe: Cafe): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name)}&query_place_id=${encodeURIComponent(cafe.id)}`;
}

/**
 * 表示用のドメイン名。
 *
 * Places の websiteUri は基本 http(s) だが、値は第三者由来なので
 * スキームを検証してから使う（javascript: などをリンクにしない）。
 * 検証を通らなければ null を返し、呼び出し側は行ごと出さない。
 */
export function getCafeDomain(cafe: Cafe): string | null {
    const url = parseCafeWebsite(cafe);
    return url ? url.hostname.replace(/^www\./, '') : null;
}

/** リンクに使ってよい websiteUri だけを返す。 */
export function parseCafeWebsite(cafe: Cafe): URL | null {
    if (!cafe.websiteUri) return null;

    try {
        const url = new URL(cafe.websiteUri);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
    } catch {
        return null;
    }
}

/**
 * 今日の営業時間を返す。
 *
 * Places の weekdayDescriptions は「月曜日: 8時00分～19時00分」形式で**月曜始まりの 7 要素**。
 * JS の getDay() は日曜始まり（0=日）なので、そのまま添字にすると 1 日ずれる。
 */
export function getTodayHours(weekdayDescriptions?: string[]): string | null {
    if (!weekdayDescriptions || weekdayDescriptions.length < 7) {
        return null;
    }

    const mondayFirstIndex = (new Date().getDay() + 6) % 7;
    const line = weekdayDescriptions[mondayFirstIndex];

    // 「月曜日: 」の接頭辞は行内で重複するので落とす（ラベルが「営業時間」なので曜日は要らない）
    return line?.replace(/^[^:：]+[:：]\s*/, '') ?? null;
}

/**
 * 今日の開店時刻だけを取り出す（カードの「13:00-」）。
 *
 * weekdayDescriptions は「8時00分～20時00分」のような日本語表記なので、
 * 先頭の「H時MM分」を H:MM に直す。定休日（時刻を含まない行）は null。
 */
export function getOpeningTime(weekdayDescriptions?: string[]): string | null {
    const line = getTodayHours(weekdayDescriptions);
    const matched = line?.match(/(\d{1,2})時(\d{2})分/);
    return matched ? `${matched[1]}:${matched[2]}` : null;
}

/**
 * 営業状態を短い一言にする。
 *
 * closesAt / opensAt はサーバーがレスポンス時に JST で計算した値
 * （キャッシュ済みの openNow が嘘をつかないようにするため）。
 * 時刻が取れないときは null を返し、呼び出し側は何も出さない。
 */
export type OpenStatusLabel = { value: string; suffix: string };

export function getOpenStatusLabel(cafe: Cafe): OpenStatusLabel | null {
    if (cafe.openNow === true && cafe.closesAt) {
        return { value: cafe.closesAt, suffix: 'まで' };
    }

    if (cafe.openNow === false && cafe.opensAt) {
        return { value: cafe.opensAt, suffix: 'から' };
    }

    return null;
}

/**
 * 営業状態をカードの枠線色にする。地図ピンの枠色と同じ意味で使う。
 * 枠線は非テキスト要素なので -500 系をそのまま使ってよい（必要な比は 3:1）。
 * → docs/design-tokens.md「営業状態の表現」
 */
export function openStatusBorder(openNow?: boolean): string {
    if (openNow === undefined) return 'border-border';
    return openNow ? 'border-success' : 'border-accent';
}
