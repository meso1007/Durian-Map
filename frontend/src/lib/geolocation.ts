/**
 * 現在地取得レイヤー。
 *
 * ブラウザでは `navigator.geolocation` を使うが、iOS の WKWebView では
 * これが使えないため Capacitor の Geolocation プラグインに差し替える。
 * UI から `navigator.geolocation` を直接呼ばないこと。→ docs/platform-strategy.md
 */

import type { Coordinates } from './api';
import { isNativePlatform } from './platform';

/** 呼び出し側が message をそのままユーザーに見せられるエラー。 */
export class GeolocationError extends Error {
    constructor(
        message: string,
        /** 端末/ブラウザがそもそも位置情報に対応していない場合に true。 */
        readonly unsupported = false,
    ) {
        super(message);
        this.name = 'GeolocationError';
    }
}

const TIMEOUT_MS = 10000;
const MAXIMUM_AGE_MS = 60000;

const DENIED_MESSAGE =
    '現在地を取得できませんでした。端末とブラウザの位置情報権限をご確認ください。';

/**
 * 現在地を取得する。失敗時は GeolocationError を投げる。
 */
export async function getCurrentPosition(): Promise<Coordinates> {
    if (isNativePlatform()) {
        return getNativePosition();
    }

    return getBrowserPosition();
}

async function getNativePosition(): Promise<Coordinates> {
    // ネイティブ側は動的 import にして、Web のバンドルに載せない。
    const { Geolocation } = await import('@capacitor/geolocation');

    try {
        const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: TIMEOUT_MS,
            maximumAge: MAXIMUM_AGE_MS,
        });

        return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
        // 権限拒否・タイムアウトいずれもユーザーにできることは同じなので文言は分けない。
        throw new GeolocationError(DENIED_MESSAGE);
    }
}

function getBrowserPosition(): Promise<Coordinates> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        throw new GeolocationError(
            'お使いのブラウザは位置情報取得に対応していません。',
            true,
        );
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) =>
                resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            () => reject(new GeolocationError(DENIED_MESSAGE)),
            {
                enableHighAccuracy: true,
                timeout: TIMEOUT_MS,
                maximumAge: MAXIMUM_AGE_MS,
            },
        );
    });
}
