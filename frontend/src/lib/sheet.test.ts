import { describe, expect, it } from 'vitest';

import { getSnapHeights, nextSnap, resolveSnap, rubberBand } from './sheet';

const heights = getSnapHeights(844, { topInset: 76, bottomInset: 0 });

describe('getSnapHeights', () => {
    it('3 段を peek < half < full の順に並べる', () => {
        expect(heights).toEqual({ peek: 96, half: 422, full: 768 });
    });

    it('セーフエリアの分だけ peek を高くする', () => {
        expect(getSnapHeights(844, { topInset: 76, bottomInset: 34 }).peek).toBe(130);
    });

    it('低い画面でも half が full を越えない', () => {
        const low = getSnapHeights(320, { topInset: 240, bottomInset: 0 });
        expect(low.full).toBe(80);
        expect(low.half).toBeLessThanOrEqual(low.full);
        expect(low.peek).toBeLessThanOrEqual(low.half);
    });
});

describe('resolveSnap', () => {
    it('ゆっくり離したら、いちばん近い段で止まる', () => {
        expect(resolveSnap(400, 0, heights)).toBe('half');
        expect(resolveSnap(700, 0.1, heights)).toBe('full');
        expect(resolveSnap(150, -0.1, heights)).toBe('peek');
    });

    it('速く上へ払ったら、近い段が下でも上の段へ進む', () => {
        expect(resolveSnap(430, 1.2, heights)).toBe('full');
        expect(resolveSnap(100, 1.2, heights)).toBe('half');
    });

    it('速く下へ払ったら、下の段へ進む', () => {
        expect(resolveSnap(760, -1.2, heights)).toBe('half');
        expect(resolveSnap(400, -1.2, heights)).toBe('peek');
    });

    it('端より先へ払っても端で止まる', () => {
        expect(resolveSnap(780, 2, heights)).toBe('full');
        expect(resolveSnap(80, -2, heights)).toBe('peek');
    });
});

describe('nextSnap', () => {
    it('half → full → peek → half と一巡する', () => {
        expect(nextSnap('half')).toBe('full');
        expect(nextSnap('full')).toBe('peek');
        expect(nextSnap('peek')).toBe('half');
    });
});

describe('rubberBand', () => {
    it('範囲内はそのまま返す', () => {
        expect(rubberBand(400, heights)).toBe(400);
    });

    it('端を越えた分は 1/4 だけ動かす', () => {
        expect(rubberBand(808, heights)).toBe(778);
        expect(rubberBand(56, heights)).toBe(86);
    });
});
