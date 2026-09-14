import { describe, expect, it } from 'vitest';

import {
    buildBudgetKey,
    incrementBudget,
    isBudgetExceeded,
    jstDateKey,
    parseBudget,
} from './budget';
import type { CounterStore } from './budget';

/** KV の代わり。薄いインターフェースにしてあるので Map で足りる。 */
function memoryStore(initial: Record<string, string> = {}): CounterStore & {
    entries: Map<string, string>;
} {
    const entries = new Map(Object.entries(initial));
    return {
        entries,
        async get(key) {
            return entries.get(key) ?? null;
        },
        async put(key, value) {
            entries.set(key, value);
        },
    };
}

/** get / put が必ず落ちる KV。 */
const brokenStore: CounterStore = {
    async get() {
        throw new Error('KV down');
    },
    async put() {
        throw new Error('KV down');
    },
};

const NOW = new Date('2026-09-15T05:00:00Z'); // JST では 14:00

describe('jstDateKey', () => {
    it('JST の日付で数える', () => {
        expect(jstDateKey(NOW)).toBe('20260915');
    });

    it('UTC の日付が変わっても JST の 0 時までは同じ日', () => {
        // UTC 2026-09-15 15:00 = JST 2026-09-16 0:00。
        expect(jstDateKey(new Date('2026-09-15T14:59:00Z'))).toBe('20260915');
        expect(jstDateKey(new Date('2026-09-15T15:00:00Z'))).toBe('20260916');
    });
});

describe('buildBudgetKey', () => {
    it('種別ごとに別のカウンタになる', () => {
        expect(buildBudgetKey('search', NOW)).toBe('budget:20260915:search');
        expect(buildBudgetKey('photo', NOW)).toBe('budget:20260915:photo');
    });
});

describe('isBudgetExceeded', () => {
    it('上限未満なら通す', async () => {
        const store = memoryStore({ 'budget:20260915:search': '299' });
        expect(await isBudgetExceeded(store, 'search', 300, NOW)).toBe(false);
    });

    it('上限ちょうどで止める', async () => {
        const store = memoryStore({ 'budget:20260915:search': '300' });
        expect(await isBudgetExceeded(store, 'search', 300, NOW)).toBe(true);
    });

    it('カウンタが無ければ通す', async () => {
        expect(await isBudgetExceeded(memoryStore(), 'photo', 3000, NOW)).toBe(false);
    });

    /** ここで止めると KV 障害がそのままサービス停止になる。 */
    it('KV が落ちていても通す（fail open）', async () => {
        expect(await isBudgetExceeded(brokenStore, 'search', 300, NOW)).toBe(false);
    });
});

describe('incrementBudget', () => {
    it('1 ずつ増える', async () => {
        const store = memoryStore();
        await incrementBudget(store, 'search', NOW);
        await incrementBudget(store, 'search', NOW);
        expect(store.entries.get('budget:20260915:search')).toBe('2');
    });

    it('KV が落ちていても例外を投げない', async () => {
        await expect(incrementBudget(brokenStore, 'search', NOW)).resolves.toBeUndefined();
    });
});

describe('parseBudget', () => {
    it('数値でも文字列でも受ける', () => {
        expect(parseBudget(300, 1)).toBe(300);
        expect(parseBudget('300', 1)).toBe(300);
    });

    it('壊れた値は既定値', () => {
        expect(parseBudget(undefined, 300)).toBe(300);
        expect(parseBudget('', 300)).toBe(300);
        expect(parseBudget('abc', 300)).toBe(300);
        expect(parseBudget(-1, 300)).toBe(300);
    });
});
