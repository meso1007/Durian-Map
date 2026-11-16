import { describe, expect, it } from 'vitest';

import type { Cafe } from './api';
import { AI_TARGETS, buildAiPrompt } from './aiPrompt';

const url = 'https://durian-map.pages.dev/?area=%E8%B0%B7%E4%B8%AD';
const cafe = (name: string, extra: Partial<Cafe> = {}): Cafe => ({ id: name, name, address: '〒110-0001 東京都台東区谷中３丁目', ...extra });

describe('buildAiPrompt', () => {
    it('未検索なら、URL を渡してエリアを尋ねさせる', () => {
        const prompt = buildAiPrompt({ url, title: null, cafes: [], selected: null });
        expect(prompt).toContain(url);
        expect(prompt).toContain('どのあたりで探したいか');
    });

    it('一覧があれば、候補を箇条書きで入れる（最大 8 軒・郵便番号は落とす）', () => {
        const cafes = Array.from({ length: 12 }, (_, i) => cafe(`店${i}`, { rating: 4.5, userRatingCount: 10, openNow: true, closesAt: '19:00' }));
        const prompt = buildAiPrompt({ url, title: '谷中のカフェ', cafes, selected: null });

        expect(prompt).toContain('谷中のカフェを探していて、次の 8 軒が候補です');
        expect(prompt.match(/^- /gm)).toHaveLength(8);
        expect(prompt).toContain('- 店0: 評価 4.5（10件） / 営業中 19:00まで / 東京都台東区谷中３丁目');
        expect(prompt).not.toContain('〒');
    });

    it('詳細を開いていれば、その店だけを尋ねる', () => {
        const prompt = buildAiPrompt({ url, title: '谷中のカフェ', cafes: [cafe('A'), cafe('B')], selected: cafe('HAGISO', { websiteUri: 'https://hagiso.com/' }) });
        expect(prompt).toContain('いま「HAGISO」を見ています');
        expect(prompt).toContain('https://hagiso.com/');
        expect(prompt).not.toContain('- B:');
    });
});

describe('AI_TARGETS', () => {
    it('プロンプトを q に入れて開く', () => {
        const [chatgpt, claude] = AI_TARGETS;
        expect(chatgpt.href('カフェ & 地図')).toBe('https://chatgpt.com/?q=%E3%82%AB%E3%83%95%E3%82%A7%20%26%20%E5%9C%B0%E5%9B%B3');
        expect(claude.href('a b')).toBe('https://claude.ai/new?q=a%20b');
    });
});
