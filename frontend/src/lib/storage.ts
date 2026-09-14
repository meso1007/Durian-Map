/**
 * 保存済みカフェの永続化レイヤー。
 *
 * 現在の実体はブラウザの localStorage だが、UI から直接 localStorage を
 * 触らせないことで、後からネイティブストレージ（Capacitor Preferences）や
 * サーバー保存に差し替えられるようにしている。→ docs/platform-strategy.md
 *
 * そのため API は**非同期**にしてある。実体が同期的な localStorage でも、
 * 呼び出し側を最初から await で書いておけば差し替え時に UI を直さずに済む。
 *
 * UI コンポーネントから localStorage を直接呼ばないこと。
 */

import type { Cafe } from './api';

const SAVED_CAFES_KEY = 'saved_cafes';

/** SSR 中やプライベートブラウジングでも落ちないようにする。 */
function getStore(): Storage | null {
    try {
        if (typeof window === 'undefined') return null;
        return window.localStorage;
    } catch {
        // Safari のプライベートモードなどでアクセス自体が throw することがある。
        return null;
    }
}

/** 保存済みカフェを読み出す。壊れたデータは空配列として扱う。 */
export async function loadSavedCafes(): Promise<Cafe[]> {
    const store = getStore();
    if (!store) return [];

    try {
        const raw = store.getItem(SAVED_CAFES_KEY);
        if (!raw) return [];

        const parsed: unknown = JSON.parse(raw);

        // 壊れたデータや古い形式で UI を落とさない。
        if (!Array.isArray(parsed)) return [];

        return parsed.filter(isCafe);
    } catch {
        return [];
    }
}

/** 保存済みカフェを書き込む。容量超過などで失敗しても例外は投げない。 */
export async function saveSavedCafes(cafes: Cafe[]): Promise<void> {
    const store = getStore();
    if (!store) return;

    try {
        store.setItem(SAVED_CAFES_KEY, JSON.stringify(cafes));
    } catch (error) {
        // QuotaExceededError など。保存に失敗しても操作自体は続行させる。
        console.error('Failed to persist saved cafes:', error);
    }
}

function isCafe(value: unknown): value is Cafe {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<Cafe>;
    return typeof candidate.id === 'string' && typeof candidate.name === 'string';
}
