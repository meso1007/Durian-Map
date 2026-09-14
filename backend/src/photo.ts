import { sha256Hex } from './cache';

/**
 * 写真 URL の署名とサイズの正規化。
 *
 * `/api/photo` は無認証で Places の写真を返すので、そのままだと
 * 「任意の写真 × 任意のサイズ」を誰でも取れる無料 CDN になる（1 枚 $0.007）。
 * 検索レスポンスで配った写真だけを、決めたサイズでだけ取れるようにする。
 */

/** 例: places/ChIJxxxx/photos/yyyy。ここが SSRF に対する唯一の防御線。 */
export const PHOTO_NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/** 受け付ける写真サイズ。任意値を許すとキャッシュキーが 256 万通りに増える。 */
export const PHOTO_SIZES = [200, 400, 800];

export const DEFAULT_PHOTO_SIZE = 400;

/** サイズを選択肢のうち最も近い値へ寄せる。 */
export function snapPhotoSize(value: number | undefined): number {
    if (value == null || !Number.isFinite(value)) return DEFAULT_PHOTO_SIZE;
    return PHOTO_SIZES.reduce((best, choice) =>
        Math.abs(choice - value) < Math.abs(best - value) ? choice : best,
    );
}

async function importKey(signingKey: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(signingKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
    );
}

/** 写真リソース名の署名（hex）。検索レスポンスの photoSig に載せる。 */
export async function signPhotoName(signingKey: string, photoName: string): Promise<string> {
    const key = await importKey(signingKey);
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(photoName),
    );
    return [...new Uint8Array(signature)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * 署名を検証する。
 *
 * 自前で文字列比較すると先頭から一致した長さが応答時間に出るので、
 * タイミング安全な `crypto.subtle.verify` に渡す。
 */
export async function verifyPhotoSignature(
    signingKey: string,
    photoName: string,
    signature: string,
): Promise<boolean> {
    const bytes = hexToBytes(signature);
    if (!bytes) return false;

    const key = await importKey(signingKey);
    return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(photoName));
}

function hexToBytes(hex: string): Uint8Array | null {
    if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/**
 * 写真バイナリの KV キー。サイズを正規化した後の値で作ること。
 *
 * 写真リソース名は実測で 457〜494 文字ある。そのまま連結すると
 * `photo:v1:` + name + `:800x800` で **511 バイト**になり、KV のキー上限 512 バイトに
 * 1 バイトしか余裕がない。少しでも長い名前が来た瞬間に写真キャッシュが静かに死ぬ
 * （= 費用対策が丸ごと効かなくなる）ので、検索キーと同じくハッシュにして長さを固定する。
 */
export async function buildPhotoCacheKey(
    photoName: string,
    maxWidthPx: number,
    maxHeightPx: number,
): Promise<string> {
    return `photo:v1:${await sha256Hex(photoName)}:${maxWidthPx}x${maxHeightPx}`;
}
