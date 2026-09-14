import { describe, expect, it } from 'vitest';

import {
    PHOTO_NAME_PATTERN,
    buildPhotoCacheKey,
    signPhotoName,
    snapPhotoSize,
    verifyPhotoSignature,
} from './photo';

const KEY = 'test-signing-key-0123456789';
const NAME = 'places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AeJbb3c_photo-reference';

describe('signPhotoName / verifyPhotoSignature', () => {
    it('署名は hex で安定している', async () => {
        const a = await signPhotoName(KEY, NAME);
        const b = await signPhotoName(KEY, NAME);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
        expect(a).toBe(b);
    });

    it('自分で作った署名は検証できる', async () => {
        const sig = await signPhotoName(KEY, NAME);
        expect(await verifyPhotoSignature(KEY, NAME, sig)).toBe(true);
    });

    it('別の写真名の署名は通らない', async () => {
        const sig = await signPhotoName(KEY, NAME);
        expect(await verifyPhotoSignature(KEY, `${NAME}x`, sig)).toBe(false);
    });

    it('鍵が違えば通らない', async () => {
        const sig = await signPhotoName(KEY, NAME);
        expect(await verifyPhotoSignature('another-key', NAME, sig)).toBe(false);
    });

    it('壊れた署名でも例外にせず false を返す', async () => {
        const broken = ['', 'deadbeef', 'zz', 'not-hex', 'abc', '0'.repeat(64)];
        for (const sig of broken) {
            expect(await verifyPhotoSignature(KEY, NAME, sig)).toBe(false);
        }
    });
});

describe('PHOTO_NAME_PATTERN', () => {
    it('正しい写真名を受け付ける', () => {
        expect(PHOTO_NAME_PATTERN.test(NAME)).toBe(true);
        expect(PHOTO_NAME_PATTERN.test('places/abc/photos/def')).toBe(true);
        expect(PHOTO_NAME_PATTERN.test('places/a-b_c/photos/d-e_f')).toBe(true);
    });

    /** ここが SSRF に対する唯一の防御線。壊すと任意の URL を Worker から叩ける。 */
    it.each([
        ['親ディレクトリ', 'places/../../photos/x'],
        ['認証情報付きホスト', 'places/a@evil.example.com/photos/x'],
        ['NUL バイト', 'places/a%00/photos/x'],
        ['クエリの追加', 'places/a/photos/x?key=leak'],
        ['フラグメント', 'places/a/photos/x#frag'],
        ['バックスラッシュ', 'places\\a\\photos\\x'],
        ['ドット', 'places/a./photos/x'],
        ['大文字の places', 'Places/a/photos/x'],
        ['空', ''],
    ])('%s は拒否する', (_label, name) => {
        expect(PHOTO_NAME_PATTERN.test(name)).toBe(false);
    });

    it('絶対 URL やスキームを拒否する', () => {
        expect(PHOTO_NAME_PATTERN.test('https://evil.example.com/x')).toBe(false);
        expect(PHOTO_NAME_PATTERN.test('//evil.example.com/x')).toBe(false);
    });
});

describe('snapPhotoSize', () => {
    it('最も近い選択肢に寄せる', () => {
        expect(snapPhotoSize(200)).toBe(200);
        expect(snapPhotoSize(240)).toBe(200);
        expect(snapPhotoSize(360)).toBe(400);
        expect(snapPhotoSize(1600)).toBe(800);
        expect(snapPhotoSize(1)).toBe(200);
    });

    it('未指定や壊れた値は既定サイズ', () => {
        expect(snapPhotoSize(undefined)).toBe(400);
        expect(snapPhotoSize(Number.NaN)).toBe(400);
    });
});

describe('buildPhotoCacheKey', () => {
    it('サイズごとに別キーになる', async () => {
        expect(await buildPhotoCacheKey(NAME, 400, 400)).toMatch(/^photo:v1:[0-9a-f]{64}:400x400$/);
        expect(await buildPhotoCacheKey(NAME, 400, 400)).not.toBe(
            await buildPhotoCacheKey(NAME, 800, 800),
        );
    });

    it('写真ごとに別キーになる', async () => {
        expect(await buildPhotoCacheKey(NAME, 400, 400)).not.toBe(
            await buildPhotoCacheKey(`${NAME}x`, 400, 400),
        );
    });

    /**
     * 実際の写真リソース名は 457〜494 文字ある。生の名前を連結すると KV のキー上限
     * 512 バイトに 1 バイトしか余裕がなく、少し長いだけで写真キャッシュが静かに死ぬ。
     */
    it('写真名がどれだけ長くてもキー長は一定で KV の上限に収まる', async () => {
        const long = `places/${'a'.repeat(400)}/photos/${'b'.repeat(400)}`;
        const key = await buildPhotoCacheKey(long, 800, 800);
        expect(key.length).toBe((await buildPhotoCacheKey(NAME, 800, 800)).length);
        expect(new TextEncoder().encode(key).length).toBeLessThan(512);
    });
});
