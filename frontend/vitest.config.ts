import { defineConfig } from 'vitest/config';

// 対象は lib/ の純関数だけ（DOM を使うテストは置いていない）。
export default defineConfig({
    test: { include: ['src/**/*.test.ts'], environment: 'node' },
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
