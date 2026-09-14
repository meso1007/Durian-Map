import { describe, expect, it } from 'vitest';

import { computeOpeningStatus, formatTime, jstMinuteOfWeek } from './opening-hours';
import type { OpeningPeriod } from './opening-hours';

/** JST の日時から Date を作る（テストの意図を読みやすくするため）。 */
function jst(day: string, time: string): Date {
    return new Date(`${day}T${time}+09:00`);
}

/** 毎日 8:00〜21:00。 */
const daily8to21: OpeningPeriod[] = Array.from({ length: 7 }, (_, day) => ({
    open: { day, hour: 8, minute: 0 },
    close: { day, hour: 21, minute: 0 },
}));

/** 金曜 22:00〜土曜 2:00 の深夜営業。 */
const lateNight: OpeningPeriod[] = [
    { open: { day: 5, hour: 22, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } },
];

/** 24 時間営業（close なし）。 */
const alwaysOpen: OpeningPeriod[] = [{ open: { day: 0, hour: 0, minute: 0 } }];

describe('computeOpeningStatus', () => {
    it('営業時間内なら openNow と closesAt を返す', () => {
        // 2026-09-15 は火曜。
        const status = computeOpeningStatus(daily8to21, jst('2026-09-15', '14:00:00'));
        expect(status).toEqual({ openNow: true, closesAt: '21:00' });
    });

    it('開店前なら openNow false と当日の opensAt を返す', () => {
        const status = computeOpeningStatus(daily8to21, jst('2026-09-15', '07:00:00'));
        expect(status).toEqual({ openNow: false, opensAt: '8:00' });
    });

    it('閉店後なら翌日の opensAt を返す', () => {
        const status = computeOpeningStatus(daily8to21, jst('2026-09-15', '22:30:00'));
        expect(status).toEqual({ openNow: false, opensAt: '8:00' });
    });

    it('開店ちょうどは営業中、閉店ちょうどは閉店', () => {
        expect(computeOpeningStatus(daily8to21, jst('2026-09-15', '08:00:00')).openNow).toBe(
            true,
        );
        expect(computeOpeningStatus(daily8to21, jst('2026-09-15', '21:00:00')).openNow).toBe(
            false,
        );
    });

    describe('深夜跨ぎ', () => {
        // 2026-09-18 は金曜、2026-09-19 は土曜。
        it('日付が変わる前は営業中', () => {
            expect(computeOpeningStatus(lateNight, jst('2026-09-18', '23:30:00'))).toEqual({
                openNow: true,
                closesAt: '2:00',
            });
        });

        it('日付が変わった後も閉店時刻までは営業中', () => {
            expect(computeOpeningStatus(lateNight, jst('2026-09-19', '01:30:00'))).toEqual({
                openNow: true,
                closesAt: '2:00',
            });
        });

        it('閉店後は次の金曜が opensAt', () => {
            expect(computeOpeningStatus(lateNight, jst('2026-09-19', '03:00:00'))).toEqual({
                openNow: false,
                opensAt: '22:00',
            });
        });
    });

    it('24 時間営業は常に営業中で closesAt を持たない', () => {
        expect(computeOpeningStatus(alwaysOpen, jst('2026-09-15', '03:00:00'))).toEqual({
            openNow: true,
        });
    });

    it('periods が無ければすべて undefined（「閉店」ではなく「不明」）', () => {
        expect(computeOpeningStatus(undefined, jst('2026-09-15', '14:00:00'))).toEqual({});
        expect(computeOpeningStatus([], jst('2026-09-15', '14:00:00'))).toEqual({});
    });

    it('JST 固定で判定する（実行環境のタイムゾーンに依存しない）', () => {
        // UTC では 2026-09-15 の 23:00 だが JST では 16 日の 8:00。
        const status = computeOpeningStatus(daily8to21, new Date('2026-09-15T23:00:00Z'));
        expect(status.openNow).toBe(true);
    });

    it('曜日ごとに営業時間が違っても正しく拾う', () => {
        // 火曜だけ 10:00〜15:00。
        const periods: OpeningPeriod[] = [
            { open: { day: 2, hour: 10, minute: 0 }, close: { day: 2, hour: 15, minute: 0 } },
            { open: { day: 3, hour: 8, minute: 0 }, close: { day: 3, hour: 21, minute: 0 } },
        ];
        expect(computeOpeningStatus(periods, jst('2026-09-15', '12:00:00'))).toEqual({
            openNow: true,
            closesAt: '15:00',
        });
        expect(computeOpeningStatus(periods, jst('2026-09-15', '16:00:00'))).toEqual({
            openNow: false,
            opensAt: '8:00',
        });
    });
});

describe('formatTime', () => {
    it('時は 0 詰めせず分は 2 桁にする', () => {
        expect(formatTime(21, 0)).toBe('21:00');
        expect(formatTime(8, 0)).toBe('8:00');
        expect(formatTime(8, 30)).toBe('8:30');
        expect(formatTime(0, 5)).toBe('0:05');
    });
});

describe('jstMinuteOfWeek', () => {
    it('日曜 0:00 を 0 とする', () => {
        // 2026-09-13 は日曜。
        expect(jstMinuteOfWeek(jst('2026-09-13', '00:00:00'))).toBe(0);
        expect(jstMinuteOfWeek(jst('2026-09-13', '01:30:00'))).toBe(90);
        // 火曜 0:00 = 2 日分。
        expect(jstMinuteOfWeek(jst('2026-09-15', '00:00:00'))).toBe(2 * 24 * 60);
    });
});
