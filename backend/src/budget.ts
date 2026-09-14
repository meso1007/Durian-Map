/**
 * 日次の予算ブレーカ。
 *
 * レート制限は 1 クライアントあたりの制限なので、分散して叩かれると効かない。
 * 「1 日に Places へ投げる回数」の上限を別に持ち、超えたら 503 を返して
 * **請求が青天井にならないように機械的に止める**。
 *
 * 数えるのは Places を実際に呼ぶときだけ（キャッシュヒットは数えない）。
 */

/** KV の読み書きに必要な最小限の面。テストではこれをモックする。 */
export type CounterStore = {
    get(key: string): Promise<string | null>;
    put(
        key: string,
        value: string,
        options?: { expirationTtl?: number },
    ): Promise<void>;
};

export type BudgetKind = 'search' | 'photo';

/** 日付が変わるのは JST の 0 時。UTC で数えると日本の深夜に枠が戻ってしまう。 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** カウンタは 2 日分だけ残す（前日分の確認には足りる）。 */
const COUNTER_TTL_SECONDS = 60 * 60 * 24 * 2;

/** JST の YYYYMMDD。 */
export function jstDateKey(now: Date): string {
    const jst = new Date(now.getTime() + JST_OFFSET_MS);
    const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jst.getUTCDate()).padStart(2, '0');
    return `${jst.getUTCFullYear()}${month}${day}`;
}

export function buildBudgetKey(kind: BudgetKind, now: Date): string {
    return `budget:${jstDateKey(now)}:${kind}`;
}

/**
 * 上限に達しているか。
 *
 * KV が読めないときは **fail open**（通す）。ここで止めるとキャッシュ障害が
 * そのままサービス停止になるため。取りこぼしは Google Cloud 側の予算アラートで拾う。
 *
 * 判定と加算は別々の KV 操作なので**ソフトリミット**である。上限付近に同時アクセスが
 * 来ると数回分は超えうる。厳密に止めたいなら Durable Object が要るが、ここでの目的は
 * 「桁が変わる請求を止める」ことなので、その精度は要らない。
 */
export async function isBudgetExceeded(
    store: CounterStore,
    kind: BudgetKind,
    limit: number,
    now: Date = new Date(),
): Promise<boolean> {
    if (!Number.isFinite(limit) || limit <= 0) return false;

    try {
        const current = Number((await store.get(buildBudgetKey(kind, now))) ?? '0');
        return Number.isFinite(current) && current >= limit;
    } catch (error) {
        console.error('budget_read_failed', { kind, error: String(error) });
        return false;
    }
}

/** 1 回分を加算する。KV は結果整合なので多少の取りこぼしは許容する。 */
export async function incrementBudget(
    store: CounterStore,
    kind: BudgetKind,
    now: Date = new Date(),
): Promise<void> {
    const key = buildBudgetKey(kind, now);
    try {
        const current = Number((await store.get(key)) ?? '0');
        const next = Number.isFinite(current) ? current + 1 : 1;
        await store.put(key, String(next), { expirationTtl: COUNTER_TTL_SECONDS });
    } catch (error) {
        console.error('budget_write_failed', { kind, error: String(error) });
    }
}

/** wrangler.jsonc の vars は数値でも文字列でも来うるので受け口を広くしておく。 */
export function parseBudget(value: string | number | undefined, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
