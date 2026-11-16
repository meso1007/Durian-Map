import { describe, expect, it } from 'vitest';

import { addRecentArea } from './storage';

describe('addRecentArea', () => {
    it('新しい検索を先頭に足す', () => {
        expect(addRecentArea(['蔵前'], '中目黒')).toEqual(['中目黒', '蔵前']);
    });

    it('同じエリアは先頭へ移すだけで増やさない', () => {
        expect(addRecentArea(['中目黒', '蔵前', '谷中'], '谷中')).toEqual(['谷中', '中目黒', '蔵前']);
    });

    it('5 件を超えたら古いものから落とす', () => {
        expect(addRecentArea(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['f', 'a', 'b', 'c', 'd']);
    });

    it('空白だけの入力は足さない', () => {
        expect(addRecentArea(['蔵前'], '  ')).toEqual(['蔵前']);
    });
});
