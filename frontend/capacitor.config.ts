import type { CapacitorConfig } from '@capacitor/cli';

/**
 * iOS（Capacitor）の設定。方針は docs/platform-strategy.md。
 *
 * webDir は Next.js の静的書き出し先（`next build` → `out/`）。
 * ビルド手順は frontend/README.md を参照。
 */
const config: CapacitorConfig = {
    appId: 'com.durianmap.app',
    appName: 'Durian Map',
    webDir: 'out',
    ios: {
        // WebView の背景。起動直後の白フラッシュを画面色（--dm-surface）に合わせる。
        backgroundColor: '#FFF7E6',
        // 端末の文字サイズ設定で WebView 全体が拡大縮小しないようにする。
        // 文字サイズはアプリ内のデザイン（docs/design.md）で担保する。
        contentInset: 'never',
    },
    plugins: {
        SplashScreen: {
            backgroundColor: '#FFF7E6',
            launchAutoHide: true,
            launchShowDuration: 500,
        },
    },
};

export default config;
