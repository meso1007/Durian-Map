/**
 * 保存済みカフェの永続化レイヤー。
 *
 * 実体は Web ではブラウザの localStorage、iOS（Capacitor）ではネイティブの
 * Preferences（UserDefaults）。UI から直接 localStorage を触らせないことで、
 * 実体の差し替えを UI の修正なしで吸収している。→ docs/platform-strategy.md
 *
 * そのため API は**非同期**にしてある。実体が同期的な localStorage でも、
 * 呼び出し側を最初から await で書いておけば差し替え時に UI を直さずに済む。
 *
 * UI コンポーネントから localStorage を直接呼ばないこと。
 */

import type { Cafe } from './api';
import { isNativePlatform } from './platform';

const SAVED_CAFES_KEY = 'saved_cafes';
const RECENT_AREAS_KEY = 'recent_areas';

/** 最近の検索として覚えておく件数。初回表示のチップ 1 行に収まる数。 */
const RECENT_AREAS_LIMIT = 5;

/** 保存したカフェの状態。デザイン案の保存画面のセグメントに対応する。 */
export type SavedStatus = 'want' | 'visited';

export type SavedCafe = Cafe & {
    status: SavedStatus;
    /** ISO 8601。保存順の並び替えに使う。 */
    savedAt: string;
};

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

/**
 * 生の JSON 文字列を読む。存在しない・読めない場合は null。
 *
 * ネイティブ側は動的 import にして、Web のバンドルにプラグインを載せない。
 */
async function readRaw(key: string): Promise<string | null> {
    if (isNativePlatform()) {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key });
        return value;
    }

    const store = getStore();
    return store ? store.getItem(key) : null;
}

/** 生の JSON 文字列を書く。 */
async function writeRaw(key: string, value: string): Promise<void> {
    if (isNativePlatform()) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key, value });
        return;
    }

    const store = getStore();
    store?.setItem(key, value);
}

/**
 * 保存済みカフェを読み出す。壊れたデータは空配列として扱う。
 *
 * status を持たない旧形式（Cafe[] をそのまま入れていた頃のデータ）は
 * 「行きたい」として読み込む。既存ユーザーの保存を消さないため。
 */
export async function loadSavedCafes(): Promise<SavedCafe[]> {
    try {
        const raw = await readRaw(SAVED_CAFES_KEY);
        if (!raw) return [];

        const parsed: unknown = JSON.parse(raw);

        // 壊れたデータや古い形式で UI を落とさない。
        if (!Array.isArray(parsed)) return [];

        return parsed.filter(isCafeLike).map(migrate);
    } catch {
        return [];
    }
}

/**
 * 保存済みカフェを書き込む。
 *
 * 例外は投げず、成功したかどうかを返す。呼び出し側は失敗を検知して
 * 画面を元に戻し、ユーザーに伝えること（無言で失敗させない / docs/design.md 5節）。
 */
export async function saveSavedCafes(cafes: SavedCafe[]): Promise<boolean> {
    try {
        await writeRaw(SAVED_CAFES_KEY, JSON.stringify(cafes));
        return true;
    } catch (error) {
        // QuotaExceededError、プライベートモードでの書き込み拒否など。
        console.error('Failed to persist saved cafes:', error);
        return false;
    }
}

function isCafeLike(value: unknown): value is Cafe & Partial<SavedCafe> {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<Cafe>;
    return typeof candidate.id === 'string' && typeof candidate.name === 'string';
}

/** 旧形式（status / savedAt なし）を現行スキーマに寄せる。 */
function migrate(value: Cafe & Partial<SavedCafe>): SavedCafe {
    return {
        ...value,
        status: value.status === 'visited' ? 'visited' : 'want',
        savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date(0).toISOString(),
    };
}

/**
 * 最近検索したエリア名（新しい順）。初回表示で「前に探した場所」へ 1 タップで戻るために使う。
 * 壊れたデータは空として扱う。
 */
export async function loadRecentAreas(): Promise<string[]> {
    try {
        const raw = await readRaw(RECENT_AREAS_KEY);
        if (!raw) return [];

        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((value): value is string => typeof value === 'string').slice(0, RECENT_AREAS_LIMIT);
    } catch {
        return [];
    }
}

/**
 * 検索したエリア名を先頭に足した一覧を返す（同じ名前は 1 つにまとめる）。
 * 保存に使う形をここで決めておくと、画面側と保存側で件数や順序がずれない。
 */
export function addRecentArea(areas: readonly string[], area: string): string[] {
    const name = area.trim();
    if (!name) return [...areas];

    return [name, ...areas.filter((existing) => existing !== name)].slice(0, RECENT_AREAS_LIMIT);
}

/** 最近の検索を書き込む。失敗しても検索そのものには影響しないので、黙って諦める。 */
export async function saveRecentAreas(areas: readonly string[]): Promise<void> {
    try {
        await writeRaw(RECENT_AREAS_KEY, JSON.stringify(areas));
    } catch {
        // 履歴は「あると嬉しい」だけの情報。保存できなくても操作は止めない。
    }
}
