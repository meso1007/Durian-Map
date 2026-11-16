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

/** 価格帯の表示（「¥1,000〜2,000」）。priceLevel が取れない店は null。 */
export function getPriceLabel(cafe: Cafe): string | null {
    if (!cafe.priceLevel) return null;

    return PRICE_FILTERS.find((filter) => filter.levels.some((level) => level === cafe.priceLevel))?.label ?? null;
}

/**
 * 表示用の住所。
 *
 * Places の formattedAddress は「日本、〒153-0051 東京都目黒区…」のように国名と郵便番号から始まる。
 * どちらも店を選ぶ判断には効かず、幅の狭いカードでは肝心の町名を押し出してしまうので落とす。
 */
export function formatAddress(address: string): string {
    return address
        .replace(/^日本[、,]\s*/, '')
        .replace(/〒?\s*\d{3}-\d{4}\s*/, '')
        .trim();
}

/**
 * 営業時間の 1 行を時刻の表記に直す（「14時00分～3時00分」→「14:00–3:00」）。
 * 「定休日」「24 時間営業」のように時刻を含まない行はそのまま返す。
 */
export function formatHours(hours: string): string {
    return hours
        .replace(/(\d{1,2})時(\d{2})分/g, '$1:$2')
        .replace(/\s*[～〜~]\s*/g, '–')
        .replace(/\s*,\s*/g, '、')
        .replace(/24\s*時間営業/, '24時間営業')
        .trim();
}

export type DayHours = {
    /** 「月」〜「日」。 */
    day: string;
    hours: string;
    isToday: boolean;
    /** 定休日など、その日は開かない。 */
    isClosed: boolean;
};

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;

/**
 * 曜日別の営業時間を表にできる形へ直す。7 要素そろっていなければ null。
 *
 * weekdayDescriptions は**月曜始まり**。`today` は JS の Date（日曜始まり）なので添字を変換する。
 * `today` を引数に取るのはテストで日付を固定するため。
 */
export function getWeekHours(weekdayDescriptions?: string[], today: Date = new Date()): DayHours[] | null {
    if (!weekdayDescriptions || weekdayDescriptions.length < 7) return null;

    const todayIndex = (today.getDay() + 6) % 7;

    return DAY_LABELS.map((day, index) => {
        const hours = formatHours(weekdayDescriptions[index].replace(/^[^:：]+[:：]\s*/, ''));

        return { day, hours, isToday: index === todayIndex, isClosed: !/\d/.test(hours) };
    });
}

/** Google マップの経路案内を開く URL。出発地は Google マップ側が現在地で補う。 */
export function getCafeDirectionsUrl(cafe: Cafe): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cafe.name)}&destination_place_id=${encodeURIComponent(cafe.id)}`;
}

/** 1 日の中の営業時間帯。0:00 からの分。日をまたぐ営業は end が 1440 を超える（3:00 閉店 = 1620）。 */
export type HourRange = { start: number; end: number };

const DAY_MINUTES = 24 * 60;

/**
 * 整形済みの営業時間（「11:00–15:00、17:00–22:00」）を時間帯の配列に直す。
 * 「24時間営業」は 0:00–24:00。時刻を読み取れない行（定休日など）は空配列。
 */
export function parseHourRanges(hours: string): HourRange[] {
    if (hours.includes('24時間営業')) return [{ start: 0, end: DAY_MINUTES }];

    const ranges: HourRange[] = [];

    for (const matched of hours.matchAll(/(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})/g)) {
        const start = Number(matched[1]) * 60 + Number(matched[2]);
        let end = Number(matched[3]) * 60 + Number(matched[4]);
        // 閉店が開店より前の時刻なら、翌日にまたいでいる。
        if (end <= start) end += DAY_MINUTES;

        ranges.push({ start, end });
    }

    return ranges;
}

/**
 * いまから閉店までの分。closesAt はサーバーが JST で返す今日の閉店時刻（"21:00" / 日またぎは "3:00"）。
 * 端末のタイムゾーンに関係なく JST で比べる。読み取れなければ null。
 */
export function getMinutesUntilClose(closesAt: string | undefined, now: Date = new Date()): number | null {
    const matched = closesAt?.match(/^(\d{1,2}):(\d{2})$/);
    if (!matched) return null;

    // UTC に 9 時間足して UTC のゲッターで読むと、JST の時・分になる。
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const nowMinutes = jst.getUTCHours() * 60 + jst.getUTCMinutes();
    const closeMinutes = Number(matched[1]) * 60 + Number(matched[2]);

    const diff = closeMinutes - nowMinutes;
    // 営業中なのに閉店時刻が過去に見えるのは、閉店が翌日（深夜営業）のとき。
    return diff >= 0 ? diff : diff + DAY_MINUTES;
}
