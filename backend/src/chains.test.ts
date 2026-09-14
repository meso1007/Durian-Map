import { describe, expect, it } from 'vitest';

import { extractHost, isChainCafe, normalizeName } from './chains';

/**
 * チェーン判定は両方向に間違えうる。
 * 実際に本番で確認された取りこぼし（FN）と誤除外（FP）をここに固定する。
 */
describe('isChainCafe', () => {
    describe('チェーンとして除外する（取りこぼしの回帰防止）', () => {
        const chains: Array<[string, string | undefined]> = [
            // NFKC 正規化が無いと素通りしていたもの。
            ['DOUTOR', undefined],
            ['ＳＴＡＲＢＵＣＫＳ', undefined],
            ['ｺﾒﾀﾞ珈琲店', undefined],
            ['ＫＦＣ 渋谷', undefined],
            // ローマ字表記。
            ['Ueshima Coffee Ten', undefined],
            ['Ginza Renoir 新宿店', undefined],
            ['Hoshino Coffee 池袋', undefined],
            // 通常表記。
            ['スターバックス コーヒー 渋谷スカイ店', undefined],
            ['タリーズコーヒー 東京駅店', undefined],
            // ドメインだけで判定できるもの（サブドメインを含む）。
            ['まちのコーヒー', 'https://shop.komeda.co.jp/'],
            ['コーヒースタンド', 'https://www.starbucks.co.jp/store/'],
        ];

        it.each(chains)('%s (%s) はチェーン', (name, websiteUri) => {
            expect(isChainCafe(name, websiteUri)).toBe(true);
        });
    });

    describe('個人店として残す（誤除外の回帰防止）', () => {
        const independents: Array<[string, string | undefined]> = [
            // ドメインを URL 全体の部分一致で見ていたため消えていたもの。
            ['コスモス珈琲', 'https://cosmos.co.jp/'],
            ['カフェ ファミリー', 'https://www.myfamily.co.jp/'],
            ['珈琲モス', 'https://kohi-mos.co.jp/'],
            // 短い語の部分一致で消えていたもの。
            ['喫茶ブリンツ', undefined],
            ['KFCafe', undefined],
            ['Komedary Coffee', undefined],
            // そもそも無関係なもの。
            ['やまねこ珈琲店', 'https://yamaneko-coffee.example.jp/'],
            ['喫茶ひぐらし', undefined],
        ];

        it.each(independents)('%s (%s) は個人店', (name, websiteUri) => {
            expect(isChainCafe(name, websiteUri)).toBe(false);
        });
    });

    it('URL が壊れていても落ちない', () => {
        expect(isChainCafe('ふつうの喫茶店', 'not a url')).toBe(false);
        expect(isChainCafe('ふつうの喫茶店', '')).toBe(false);
        expect(isChainCafe('ふつうの喫茶店', undefined)).toBe(false);
    });
});

describe('normalizeName', () => {
    it('全角英数と半角カタカナを吸収して小文字化する', () => {
        expect(normalizeName('ＳＴＡＲＢＵＣＫＳ')).toBe('starbucks');
        expect(normalizeName('ｺﾒﾀﾞ珈琲店')).toBe('コメダ珈琲店');
        expect(normalizeName('DOUTOR')).toBe('doutor');
    });
});

describe('extractHost', () => {
    it('www を落としたホスト名を返す', () => {
        expect(extractHost('https://www.komeda.co.jp/menu')).toBe('komeda.co.jp');
        expect(extractHost('http://KOMEDA.co.jp')).toBe('komeda.co.jp');
    });

    it('URL でなければ null', () => {
        expect(extractHost('komeda.co.jp')).toBeNull();
        expect(extractHost('')).toBeNull();
    });
});
