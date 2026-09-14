/**
 * 現在地取得レイヤー。
 *
 * ブラウザでは `navigator.geolocation` を使うが、iOS の WKWebView では
 * これが使えないため Capacitor の Geolocation プラグインに差し替える。
 * UI から `navigator.geolocation` を直接呼ばないこと。→ docs/platform-strategy.md
 */

import type { Coordinates } from './api';
import { isNativePlatform } from './platform';

/**
 * 失敗の種類。ユーザーに示すべき「次の一手」が違うので分けている。
 * - denied: 権限が無い → 設定を開いてもらうしかない（再試行しても同じ）
 * - timeout / unavailable: 一時的 → 再試行を促す
 * - unsupported: 端末が非対応 → 現在地機能そのものを諦めてもらう
 */
export type GeolocationErrorCode = 'denied' | 'timeout' | 'unavailable' | 'unsupported';

/** 呼び出し側が message をそのままユーザーに見せられるエラー。 */
export class GeolocationError extends Error {
    constructor(
        readonly code: GeolocationErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'GeolocationError';
    }

    /** 端末 / ブラウザがそもそも位置情報に対応していない。 */
    get unsupported(): boolean {
        return this.code === 'unsupported';
    }
}

const TIMEOUT_MS = 10000;
const MAXIMUM_AGE_MS = 60000;

const MESSAGES: Record<GeolocationErrorCode, string> = {
    denied: '位置情報が許可されていません。設定から位置情報を許可してください。',
    timeout: '現在地の取得に時間がかかっています。電波の良い場所でもう一度お試しください。',
    unavailable: '現在地を取得できませんでした。少し時間をおいて再度お試しください。',
    unsupported: 'お使いのブラウザは位置情報取得に対応していません。',
};

function fail(code: GeolocationErrorCode): GeolocationError {
    return new GeolocationError(code, MESSAGES[code]);
}

/**
 * 位置情報の権限が **すでに** 付与されているか。
 *
 * これを起動時の暗黙取得の条件にする。未許可の状態で getCurrentPosition を
 * 呼ぶと、アプリの説明を読む前に OS のダイアログが出て拒否されやすく、
 * 一度拒否されると「近くからさがす」が永久に効かなくなる。
 *
 * 判定できない環境では false（＝聞かない）に倒す。
 */
export async function hasGrantedPermission(): Promise<boolean> {
    if (isNativePlatform()) {
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const status = await Geolocation.checkPermissions();
            return status.location === 'granted' || status.coarseLocation === 'granted';
        } catch {
            return false;
        }
    }

    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return false;

    try {
        // Safari は geolocation の Permissions API に未対応で throw する。
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state === 'granted';
    } catch {
        return false;
    }
}

/** 現在地を取得する。失敗時は GeolocationError を投げる。 */
export async function getCurrentPosition(): Promise<Coordinates> {
    return isNativePlatform() ? getNativePosition() : getBrowserPosition();
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
    } catch (error) {
        throw fail(nativeErrorCode(error));
    }
}

/**
 * Capacitor は Web と違って数値の code を持たないので、メッセージで見分ける。
 * 判別できないものは「一時的な失敗」に倒す（再試行を促すほうが害が小さい）。
 */
function nativeErrorCode(error: unknown): GeolocationErrorCode {
    const message = error instanceof Error ? error.message.toLowerCase() : '';

    if (message.includes('denied') || message.includes('permission')) return 'denied';
    if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
    return 'unavailable';
}

function getBrowserPosition(): Promise<Coordinates> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return Promise.reject(fail('unsupported'));
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (error) => reject(fail(browserErrorCode(error))),
            {
                enableHighAccuracy: true,
                timeout: TIMEOUT_MS,
                maximumAge: MAXIMUM_AGE_MS,
            },
        );
    });
}

function browserErrorCode(error: GeolocationPositionError): GeolocationErrorCode {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return 'denied';
        case error.TIMEOUT:
            return 'timeout';
        default:
            return 'unavailable';
    }
}
