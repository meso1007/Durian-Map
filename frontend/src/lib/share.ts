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

/**
 * 文字列をクリップボードへ入れる。成功したかどうかを返す（呼び出し側がトーストで伝える）。
 * iOS の WebView でも navigator.clipboard は使える（ユーザー操作の中で呼ぶこと）。
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * 文章と URL を共有する（保存した店の一覧を友達に送るとき）。
 * 共有シートがあればそれを開き、無ければ「文章 + URL」をクリップボードへ入れる。
 */
export async function shareText(options: { title: string; text: string; url: string }): Promise<ShareResult> {
    if (isNativePlatform()) {
        const { Share } = await import('@capacitor/share');

        try {
            await Share.share(options);
        } catch {
            // ユーザーがシートを閉じた場合もここに来る。失敗として騒がない。
        }
        return 'shared';
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
        try {
            await navigator.share(options);
        } catch {
            // 共有シートのキャンセル。
        }
        return 'shared';
    }

    return (await copyText(`${options.text}\n${options.url}`)) ? 'copied' : 'failed';
}
