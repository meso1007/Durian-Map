import { describe, expect, it } from 'vitest';

import { buildSearchKey, sha256Hex } from './cache';

describe('buildSearchKey', () => {
    it('search:v4:<hex64> の形になる', async () => {
        const key = await buildSearchKey({ mode: 'text', category: 'カフェ', area: '渋谷' });
        expect(key).toMatch(/^search:v4:[0-9a-f]{64}$/);
    });

    it('同じ条件なら同じキー', async () => {
        const a = await buildSearchKey({ mode: 'text', category: 'カフェ', area: '渋谷' });
        const b = await buildSearchKey({ mode: 'text', category: 'カフェ', area: '渋谷' });
        expect(a).toBe(b);
    });

    it('mode が違えばキーも違う', async () => {
        const text = await buildSearchKey({ mode: 'text', category: 'カフェ', area: '渋谷' });
        const nearby = await buildSearchKey({
            mode: 'nearby',
            category: 'カフェ',
            lat: 35.659,
            lng: 139.7,
            radius: 1500,
        });
        expect(text).not.toBe(nearby);
    });

    /**
     * 平文を `:` で連結していた頃は、区切り文字を含む入力で
     * 別条件のキーを作れてしまった（キャッシュポイズニング）。
     */
    it('区切り文字を含む入力でキーを衝突させられない', async () => {
        const keys = await Promise.all([
            buildSearchKey({ mode: 'text', category: 'カフェ', area: '渋谷' }),
            buildSearchKey({ mode: 'text', category: 'カフェ', area: '渋谷:' }),
            buildSearchKey({ mode: 'text', category: 'カフェ', area: ':渋谷' }),
            buildSearchKey({ mode: 'text', category: 'カフェ:渋谷', area: '' }),
            buildSearchKey({ mode: 'text', category: 'カフェ', area: '"渋谷"' }),
        ]);
        expect(new Set(keys).size).toBe(keys.length);
    });

    /** 長い入力でも KV のキー上限（512B）を超えない。 */
    it('入力が長くてもキーの長さは一定', async () => {
        const short = await buildSearchKey({ mode: 'text', category: 'カフェ', area: '渋谷' });
        const long = await buildSearchKey({
            mode: 'text',
            category: 'カフェ',
            area: 'あ'.repeat(5000),
        });
        expect(long.length).toBe(short.length);
        expect(long.length).toBeLessThan(512);
    });

    describe('座標の丸め', () => {
        const base = { mode: 'nearby', category: 'カフェ', radius: 1500 } as const;

        it('3 桁に収まる差は同じキーになる', async () => {
            const a = await buildSearchKey({ ...base, lat: 35.65891, lng: 139.70143 });
            const b = await buildSearchKey({ ...base, lat: 35.65912, lng: 139.70076 });
            expect(a).toBe(b);
        });

        it('3 桁で変わる差は別キーになる', async () => {
            const a = await buildSearchKey({ ...base, lat: 35.659, lng: 139.701 });
            const b = await buildSearchKey({ ...base, lat: 35.66, lng: 139.701 });
            expect(a).not.toBe(b);
        });

        it('半径が違えば別キー', async () => {
            const a = await buildSearchKey({ ...base, lat: 35.659, lng: 139.701 });
            const b = await buildSearchKey({
                ...base,
                lat: 35.659,
                lng: 139.701,
                radius: 3000,
            });
            expect(a).not.toBe(b);
        });
    });
});

describe('sha256Hex', () => {
    it('既知の値と一致する', async () => {
        expect(await sha256Hex('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        );
    });
});
