/**
 * 共有レイヤー。
 *
 * ブラウザでは Web Share API、無ければクリップボードにコピーする。
 * iOS の WKWebView には `navigator.share` が無いため Capacitor の Share
 * プラグイン（ネイティブの共有シート）に差し替える。
 * UI から `navigator.share` を直接呼ばないこと。→ docs/platform-strategy.md
 */

import { isNativePlatform } from './platform';

export type ShareResult =
    /** ネイティブ/ブラウザの共有シートを開いた（またはユーザーが閉じた）。 */
    | 'shared'
    /** 共有手段が無いのでクリップボードにコピーした。呼び出し側が通知すること。 */
    | 'copied'
    /** どちらもできなかった。 */
    | 'failed';

export async function shareUrl(options: { title: string; url: string }): Promise<ShareResult> {
    if (isNativePlatform()) {
        const { Share } = await import('@capacitor/share');

        try {
            await Share.share({ title: options.title, url: options.url });
            return 'shared';
        } catch {
            // ユーザーがシートを閉じた場合もここに来る。失敗として騒がない。
            return 'shared';
        }
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
        try {
            await navigator.share({ title: options.title, url: options.url });
        } catch {
            // 共有シートのキャンセル。
        }
        return 'shared';
    }

    try {
        await navigator.clipboard.writeText(options.url);
        return 'copied';
    } catch {
        return 'failed';
    }
}
