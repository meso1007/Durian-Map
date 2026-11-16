import { describe, expect, it } from 'vitest';

import type { Cafe } from './api';
import { buildShareText, decodeSharedList, encodeSharedList, guessListTitle } from './sharedList';

const cafe = (id: string, address: string, extra: Partial<Cafe> = {}): Cafe => ({
    id,
    name: `喫茶 ${id}`,
    address,
    lat: 35.4437123,
    lng: 139.638,
    ...extra,
});

const yokohama = [
    cafe('a', '〒231-0023 神奈川県横浜市中区山下町１', { rating: 4.5 }),
    cafe('b', '〒220-0012 神奈川県横浜市西区みなとみらい２'),
];

describe('encodeSharedList / decodeSharedList', () => {
    it('往復で、店名・座標・評価・住所が戻る（郵便番号は落ちる）', () => {
        const decoded = decodeSharedList(encodeSharedList({ title: '横浜市のカフェ', cafes: yokohama }));

        expect(decoded?.title).toBe('横浜市のカフェ');
        expect(decoded?.cafes).toEqual([
            { id: 'a', name: '喫茶 a', lat: 35.44371, lng: 139.638, rating: 4.5, address: '神奈川県横浜市中区山下町１' },
            { id: 'b', name: '喫茶 b', lat: 35.44371, lng: 139.638, address: '神奈川県横浜市西区みなとみらい２' },
        ]);
    });

    it('URL にそのまま載せられる文字だけになる', () => {
        expect(encodeSharedList({ title: '横浜市のカフェ', cafes: yokohama })).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('座標の無い店は入れない。20 軒を超えた分は落とす', () => {
        const many = Array.from({ length: 25 }, (_, i) => cafe(`c${i}`, '東京都台東区谷中'));
        const encoded = encodeSharedList({ title: 't', cafes: [{ id: 'x', name: 'x', address: '' }, ...many] });

        expect(decodeSharedList(encoded)?.cafes).toHaveLength(20);
        expect(decodeSharedList(encoded)?.cafes[0].id).toBe('c0');
    });

    it('壊れた値・形の違う値は null', () => {
        expect(decodeSharedList(null)).toBeNull();
        expect(decodeSharedList('%%%')).toBeNull();
        expect(decodeSharedList(btoa('{"t":1,"c":[]}'))).toBeNull();
        expect(decodeSharedList(btoa('{"t":"x","c":[["id","name",999,0,null,""]]}'))).toBeNull();
    });
});

describe('guessListTitle', () => {
    it('全部が同じ市なら、その市の名前を付ける', () => {
        expect(guessListTitle(yokohama)).toBe('横浜市のカフェ');
    });

    it('東京 23 区は区の名前を付ける', () => {
        expect(guessListTitle([cafe('a', '東京都目黒区上目黒２')])).toBe('目黒区のカフェ');
    });

    it('ばらけていれば、場所を名乗らない', () => {
        expect(guessListTitle([...yokohama, cafe('c', '東京都目黒区上目黒２')])).toBe('行きたいカフェ');
    });
});

describe('buildShareText', () => {
    it('見出し・店ごとの住所と Google マップのリンクを並べる', () => {
        const text = buildShareText({ title: '横浜市のカフェ', cafes: yokohama });

        expect(text.split('\n')[0]).toBe('横浜市のカフェ 2軒');
        expect(text).toContain('1. 喫茶 a（★4.5）');
        expect(text).toContain('2. 喫茶 b\n   神奈川県横浜市西区みなとみらい２');
        expect(text).toContain('https://www.google.com/maps/search/?api=1&query=');
        expect(text.endsWith('地図でまとめて見る')).toBe(true);
    });
});
