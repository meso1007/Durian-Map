/**
 * iOS のアプリアイコンとスプラッシュを public/logo.svg から生成する。
 *
 *   bun run ios:assets
 *
 * ロゴの正は `public/logo.svg`（`designs/durian-map-tropical.pen` から起こしたもの）。
 * @capacitor/assets は 1024px の PNG を要求するので、ここでラスタライズしてから渡す。
 * 背景は画面と同じ `--dm-surface`（docs/design-tokens.md）。
 */

import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import sharp from 'sharp';

const SURFACE = '#FFF7E6';

await mkdir('assets', { recursive: true });

// density を上げないと SVG が低解像度でラスタライズされる。
await sharp('public/logo.svg', { density: 512 })
    .resize(1024, 1024, { fit: 'contain', background: SURFACE })
    .png()
    .toFile('assets/logo.png');

const result = spawnSync(
    'bunx',
    [
        'capacitor-assets', 'generate', '--ios',
        '--iconBackgroundColor', SURFACE,
        '--iconBackgroundColorDark', SURFACE,
        '--splashBackgroundColor', SURFACE,
        '--splashBackgroundColorDark', SURFACE,
    ],
    { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
