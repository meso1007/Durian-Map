/**
 * iOS のアプリアイコンとスプラッシュを .pen 由来のロゴから生成する。
 *
 *   bun run ios:assets
 *
 * 素材の正は `.pen`（`designs/pen-frame-to-svg.py` で SVG に起こす）。
 * ここではその SVG を iOS が要求する形にラスタライズして @capacitor/assets に渡す。
 *
 * 変種の選び方（docs/design-tokens.md「ブランドマーク」）:
 * - アイコン … `src/app/icon.svg`（App Icon フレーム）。**角丸は iOS 側が付ける**ので
 *   rx を落として全面ベタにする。透明部分が残ると App Store の審査で弾かれる。
 * - スプラッシュ … 地がクリームなので **Light 変種**（濃緑のマーク）を使う。
 *   Dark 変種（`public/logo.svg`）は濃緑面用の淡色マークで、クリーム地では見えなくなる。
 */

import { mkdir, readFile, copyFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import sharp from 'sharp';

/** --dm-surface。画面の地と揃える。 */
const SURFACE = '#FFF7E6';
/** .pen の App Icon フレームの地。 */
const ICON_BG = '#FFF9EC';

const SPLASH_SIZE = 2732;
const MARK_SIZE = 900;

await mkdir('assets', { recursive: true });

// 旧ブランドの入力が残っていると @capacitor/assets がそちらを拾いうるので消しておく。
await rm('assets/logo.png', { force: true });

// --- アプリアイコン ---------------------------------------------------
// density を上げないと SVG が低解像度でラスタライズされる。
const iconSvg = (await readFile('src/app/icon.svg', 'utf8')).replace(/rx="\d+"/, 'rx="0"');

await sharp(Buffer.from(iconSvg), { density: 512 })
    .resize(1024, 1024)
    .flatten({ background: ICON_BG }) // アルファを残さない
    .png()
    .toFile('assets/icon-only.png');

// --- スプラッシュ -----------------------------------------------------
const mark = await sharp('public/logo-light.svg', { density: 512 })
    .resize(MARK_SIZE, MARK_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

await sharp({
    create: { width: SPLASH_SIZE, height: SPLASH_SIZE, channels: 4, background: SURFACE },
})
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile('assets/splash.png');

// ダークモードは未対応（docs/design.md 6節）。同じものを使う。
await copyFile('assets/splash.png', 'assets/splash-dark.png');

const result = spawnSync(
    'bunx',
    [
        'capacitor-assets', 'generate', '--ios',
        '--iconBackgroundColor', ICON_BG,
        '--iconBackgroundColorDark', ICON_BG,
        '--splashBackgroundColor', SURFACE,
        '--splashBackgroundColorDark', SURFACE,
    ],
    { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
