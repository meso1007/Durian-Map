import { describe, expect, it } from 'vitest';

import type { Cafe } from './api';
import {
    formatAddress,
    formatHours,
    getCafeDirectionsUrl,
    getMinutesUntilClose,
    getPriceLabel,
    getWeekHours,
    parseHourRanges,
} from './cafe';

const cafe = (overrides: Partial<Cafe> = {}): Cafe => ({ id: 'ChIJ_test', name: 'Test & Cafe', address: '', ...overrides });

describe('formatAddress', () => {
    it('郵便番号を落とす', () => {
        expect(formatAddress('〒153-0051 東京都目黒区上目黒２丁目４４−２４ コムズ中目黒1 1階')).toBe(
            '東京都目黒区上目黒２丁目４４−２４ コムズ中目黒1 1階',
        );
    });

    it('国名と郵便番号の両方を落とす', () => {
        expect(formatAddress('日本、〒150-0001 東京都渋谷区神宮前１丁目')).toBe('東京都渋谷区神宮前１丁目');
    });

    it('郵便番号が無い住所はそのまま', () => {
        expect(formatAddress('東京都台東区蔵前３丁目')).toBe('東京都台東区蔵前３丁目');
    });
});

describe('formatHours', () => {
    it('時刻を H:MM に、範囲をダッシュにする', () => {
        expect(formatHours('14時00分～3時00分')).toBe('14:00–3:00');
    });

    it('昼と夜に分かれた営業時間を読点でつなぐ', () => {
        expect(formatHours('11時00分～15時00分, 17時00分～22時00分')).toBe('11:00–15:00、17:00–22:00');
    });

    it('時刻を含まない行はそのまま', () => {
        expect(formatHours('定休日')).toBe('定休日');
        expect(formatHours('24 時間営業')).toBe('24時間営業');
    });
});

describe('getWeekHours', () => {
    const week = [
        '月曜日: 定休日',
        '火曜日: 8時00分～19時00分',
        '水曜日: 8時00分～19時00分',
        '木曜日: 8時00分～19時00分',
        '金曜日: 8時00分～21時00分',
        '土曜日: 9時00分～21時00分',
        '日曜日: 24 時間営業',
    ];

    it('月曜始まりの 7 行にし、今日の行に印を付ける', () => {
        // 2026-11-14 は土曜日
        const rows = getWeekHours(week, new Date(2026, 10, 14));

        expect(rows?.map((row) => row.day).join('')).toBe('月火水木金土日');
        expect(rows?.filter((row) => row.isToday).map((row) => row.day)).toEqual(['土']);
        expect(rows?.[5].hours).toBe('9:00–21:00');
    });

    it('日曜日は最後の行が今日になる（Date は日曜始まり）', () => {
        const rows = getWeekHours(week, new Date(2026, 10, 15));
        expect(rows?.[6].isToday).toBe(true);
    });

    it('定休日だけを休みとして扱う', () => {
        const rows = getWeekHours(week, new Date(2026, 10, 14));
        expect(rows?.[0].isClosed).toBe(true);
        expect(rows?.[6].isClosed).toBe(false);
    });

    it('7 行そろっていなければ null', () => {
        expect(getWeekHours(undefined)).toBeNull();
        expect(getWeekHours(week.slice(0, 3))).toBeNull();
    });
});

describe('getPriceLabel', () => {
    it('priceLevel を 3 段の表示に直す', () => {
        expect(getPriceLabel(cafe({ priceLevel: 'PRICE_LEVEL_INEXPENSIVE' }))).toBe('〜¥1,000');
        expect(getPriceLabel(cafe({ priceLevel: 'PRICE_LEVEL_MODERATE' }))).toBe('¥1,000〜2,000');
        expect(getPriceLabel(cafe({ priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE' }))).toBe('¥2,000〜');
    });

    it('取れない・未知の値は null', () => {
        expect(getPriceLabel(cafe())).toBeNull();
        expect(getPriceLabel(cafe({ priceLevel: 'PRICE_LEVEL_UNSPECIFIED' }))).toBeNull();
    });
});

describe('getCafeDirectionsUrl', () => {
    it('店名をエスケープし、place_id を目的地にする', () => {
        expect(getCafeDirectionsUrl(cafe())).toBe(
            'https://www.google.com/maps/dir/?api=1&destination=Test%20%26%20Cafe&destination_place_id=ChIJ_test',
        );
    });
});

describe('parseHourRanges', () => {
    it('1 つの時間帯を分に直す', () => {
        expect(parseHourRanges('10:00–19:00')).toEqual([{ start: 600, end: 1140 }]);
    });

    it('昼と夜の 2 つの時間帯を読む', () => {
        expect(parseHourRanges('11:00–15:00、17:00–22:00')).toEqual([
            { start: 660, end: 900 },
            { start: 1020, end: 1320 },
        ]);
    });

    it('日をまたぐ営業は end が 24 時を超える', () => {
        expect(parseHourRanges('14:00–3:00')).toEqual([{ start: 840, end: 1620 }]);
    });

    it('24時間営業は 0:00–24:00、定休日は空', () => {
        expect(parseHourRanges('24時間営業')).toEqual([{ start: 0, end: 1440 }]);
        expect(parseHourRanges('定休日')).toEqual([]);
    });
});

describe('getMinutesUntilClose', () => {
    // 2026-11-14 18:15 JST = 09:15 UTC
    const now = new Date(Date.UTC(2026, 10, 14, 9, 15));

    it('今日の閉店までの分を JST で数える', () => {
        expect(getMinutesUntilClose('19:00', now)).toBe(45);
        expect(getMinutesUntilClose('21:30', now)).toBe(195);
    });

    it('深夜営業（閉店が翌日）は 24 時間を足す', () => {
        expect(getMinutesUntilClose('3:00', now)).toBe(525);
    });

    it('読み取れなければ null', () => {
        expect(getMinutesUntilClose(undefined, now)).toBeNull();
        expect(getMinutesUntilClose('まもなく', now)).toBeNull();
    });
});
