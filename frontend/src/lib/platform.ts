/**
 * 実行環境の判定。
 *
 * Web（ブラウザ）と iOS（Capacitor の WebView）で振る舞いを変えたい箇所は
 * すべてここを経由する。UI コンポーネントから `Capacitor` を直接 import しないこと。
 * → docs/platform-strategy.md
 *
 * 分岐してよいのは「Web に無い/使えない機能の代替」だけ。
 * 見た目やデザインはプラットフォームで分岐させない（docs/design.md 6節）。
 */

import { Capacitor } from '@capacitor/core';

/** ネイティブの殻（iOS / Android）の中で動いているか。 */
export function isNativePlatform(): boolean {
    // SSR / 静的書き出し中は window が無いので必ず false に倒す。
    if (typeof window === 'undefined') return false;

    try {
        return Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}
