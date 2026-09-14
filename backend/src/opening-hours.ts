/**
 * 営業状態の計算。
 *
 * Places の `openNow` は**レスポンスを作った時刻**の値なので、キャッシュして返すと
 * そのまま嘘になる（TTL 7 日なら 7 日間嘘をつく）。そこで `periods`（曜日と時刻の
 * 開閉ペア）だけをキャッシュし、`openNow` はレスポンスを作るたびにここで計算する。
 * これで「キャッシュを長く持つ」と「営業状態が正しい」を両立できる。
 *
 * 日本国内向けのアプリなので **JST（UTC+9）固定**で判定する。
 * Workers の実行地域に左右されないよう Date のローカル時刻は使わない。
 */

/** Places の `regularOpeningHours.periods` の 1 要素。day は 0=日曜。 */
export type OpeningPeriod = {
    open: { day: number; hour: number; minute: number };
    /** 24 時間営業の場合は close が無い。 */
    close?: { day: number; hour: number; minute: number };
};

export type OpeningStatus = {
    /** 営業中かどうか。periods が無いときは undefined（「不明」を区別する）。 */
    openNow?: boolean;
    /** 営業中のときの閉店時刻。例: "21:00"。24 時間営業なら undefined。 */
    closesAt?: string;
    /** 閉店中のときの次の開店時刻。例: "8:00"。 */
    opensAt?: string;
};

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** その週の何分目か（日曜 0:00 起点）を JST で返す。 */
export function jstMinuteOfWeek(now: Date): number {
    const jst = new Date(now.getTime() + JST_OFFSET_MS);
    return jst.getUTCDay() * MINUTES_PER_DAY + jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

/** "21:00" / "8:00" の形にする。時は 0 詰めしない。 */
export function formatTime(hour: number, minute: number): string {
    return `${hour}:${String(minute).padStart(2, '0')}`;
}

function minuteOfWeek(point: { day: number; hour: number; minute: number }): number {
    return point.day * MINUTES_PER_DAY + point.hour * 60 + point.minute;
}

/** 値域まで見る。想定外の値（day: 7 など）を通すと週境界が静かにずれる。 */
function isValidPoint(point: { day: number; hour: number; minute: number } | undefined): boolean {
    if (point == null) return false;

    return (
        Number.isInteger(point.day) &&
        point.day >= 0 &&
        point.day <= 6 &&
        Number.isInteger(point.hour) &&
        point.hour >= 0 &&
        point.hour <= 23 &&
        Number.isInteger(point.minute) &&
        point.minute >= 0 &&
        point.minute <= 59
    );
}

/**
 * 営業状態を計算する。
 *
 * - 深夜跨ぎ（22:00〜翌 2:00）は close が open より手前になるので 1 週間分足して扱う
 * - close が無い period は 24 時間営業とみなし、営業中・閉店時刻なしを返す
 * - periods が無い / 空なら全部 undefined（「不明」であって「閉店」ではない）
 */
export function computeOpeningStatus(
    periods: OpeningPeriod[] | undefined,
    now: Date,
): OpeningStatus {
    if (!periods || periods.length === 0) return {};

    const nowMinute = jstMinuteOfWeek(now);

    let nextOpenIn = Number.POSITIVE_INFINITY;
    let nextOpen: OpeningPeriod['open'] | undefined;

    for (const period of periods) {
        if (!isValidPoint(period.open)) continue;

        // close が無い = 24 時間営業。
        if (!period.close) return { openNow: true };
        // 値が壊れている period は「24 時間営業」ではなく無視する。
        if (!isValidPoint(period.close)) continue;

        const start = minuteOfWeek(period.open);
        let end = minuteOfWeek(period.close);
        // 深夜跨ぎ・週跨ぎ。
        if (end <= start) end += MINUTES_PER_WEEK;

        // 今週の並びと、先週から跨いできた分の両方を見る。
        if (
            (nowMinute >= start && nowMinute < end) ||
            (nowMinute + MINUTES_PER_WEEK >= start && nowMinute + MINUTES_PER_WEEK < end)
        ) {
            return { openNow: true, closesAt: formatTime(period.close.hour, period.close.minute) };
        }

        const until = (start - nowMinute + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
        if (until < nextOpenIn) {
            nextOpenIn = until;
            nextOpen = period.open;
        }
    }

    if (!nextOpen) return {};

    return { openNow: false, opensAt: formatTime(nextOpen.hour, nextOpen.minute) };
}
