/**
 * 保存したカフェを「友達に送る」ための一覧。
 *
 * このアプリにはサーバー側の保存先もアカウントも無いので、店の情報を URL そのものに入れて渡す
 * （`?list=…`）。受け取った側は、そのリンクを開くだけで同じ店が地図に並ぶ。
 * 入れるのは、地図に出して店を特定するのに要る最小限（id・店名・座標・評価・住所）だけ。
 * 写真と営業時間は入れない: 写真は署名付き URL で長く、営業時間は取得した時点の値で古くなる。
 */

import type { Cafe } from './api';
import { formatAddress, getCafeMapUrl } from './cafe';

/** 1 本のリンクに入れる店の上限。URL が長くなりすぎると、貼った先で切れることがある。 */
export const SHARED_LIST_LIMIT = 20;

export type SharedList = { title: string; cafes: Cafe[] };

/** URL に入れる形。キーを 1 文字にし、店は配列にして短くする。 */
type Packed = { t: string; c: [id: string, name: string, lat: number, lng: number, rating: number | null, address: string][] };

function toBase64Url(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** 座標は 5 桁（約 1m）で足りる。 */
const round = (value: number) => Number(value.toFixed(5));

/** 一覧を URL の `list` パラメータに入れる文字列にする。座標の無い店は地図に出せないので除く。 */
export function encodeSharedList({ title, cafes }: SharedList): string {
    const packed: Packed = {
        t: title,
        c: cafes
            .filter((cafe) => cafe.lat != null && cafe.lng != null)
            .slice(0, SHARED_LIST_LIMIT)
            .map((cafe) => [cafe.id, cafe.name, round(cafe.lat!), round(cafe.lng!), cafe.rating ?? null, formatAddress(cafe.address)]),
    };

    return toBase64Url(JSON.stringify(packed));
}

/** `list` パラメータから一覧を復元する。壊れた値・他人が書き換えた値は null（何も出さない）。 */
export function decodeSharedList(encoded: string | null | undefined): SharedList | null {
    if (!encoded) return null;

    try {
        const packed = JSON.parse(fromBase64Url(encoded)) as Partial<Packed>;
        if (typeof packed.t !== 'string' || !Array.isArray(packed.c)) return null;

        const cafes = packed.c.slice(0, SHARED_LIST_LIMIT).flatMap((row): Cafe[] => {
            if (!Array.isArray(row)) return [];
            const [id, name, lat, lng, rating, address] = row;

            if (typeof id !== 'string' || typeof name !== 'string') return [];
            if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];

            return [{ id, name, lat, lng, address: typeof address === 'string' ? address : '', ...(typeof rating === 'number' ? { rating } : {}) }];
        });

        // 見出しは他人が書ける文字列なので、長さだけは抑える（表示は React がエスケープする）。
        return cafes.length > 0 ? { title: packed.t.slice(0, 40), cafes } : null;
    } catch {
        return null;
    }
}

/**
 * 一覧の見出しを店の住所から決める。全部が同じ市区町村なら「横浜市のカフェ」、
 * ばらけていれば「行きたいカフェ」。ユーザーに名前を入力させないための推定。
 */
export function guessListTitle(cafes: readonly Cafe[]): string {
    const areas = cafes.map(
        (cafe) => formatAddress(cafe.address).match(/^(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県)(.+?[市区町村])/)?.[1] ?? null,
    );
    const first = areas[0];

    return first && areas.every((area) => area === first) ? `${first}のカフェ` : '行きたいカフェ';
}

/** 友達に送る文章。LINE などにそのまま貼って読めるよう、店ごとに Google マップのリンクを付ける。 */
export function buildShareText({ title, cafes }: SharedList): string {
    const lines = cafes.slice(0, SHARED_LIST_LIMIT).flatMap((cafe, index) => [
        `${index + 1}. ${cafe.name}${cafe.rating != null ? `（★${cafe.rating.toFixed(1)}）` : ''}`,
        `   ${formatAddress(cafe.address)}`,
        `   ${getCafeMapUrl(cafe)}`,
        '',
    ]);

    return [`${title} ${Math.min(cafes.length, SHARED_LIST_LIMIT)}軒`, '', ...lines, '地図でまとめて見る'].join('\n');
}
