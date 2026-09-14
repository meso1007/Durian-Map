'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import type { Cafe } from '@/lib/api';
import { getCafeMapUrl } from '@/lib/cafe';
import { isNativePlatform } from '@/lib/platform';
import { RADIUS_OPTIONS, DEFAULT_NEARBY_RADIUS, snapRadius } from './useCafeSearch';
import type { SearchQuery, SearchRadius } from './useCafeSearch';

export type { SearchQuery };

export type SearchUrlState = {
    tab: 'search' | 'saved';
    query: SearchQuery | null;
    cafeId: string | null;
};

/** 座標は 3 桁（約 110m）で丸める。URL が読みやすくなり、キャッシュにも当たりやすい。 */
const COORD_PRECISION = 3;

function roundCoord(value: number): number {
    return Number(value.toFixed(COORD_PRECISION));
}

/** 状態 → クエリ文字列（先頭の "?" 込み。空なら ""）。 */
export function buildSearchParams(state: SearchUrlState): string {
    const params = new URLSearchParams();

    if (state.tab === 'saved') params.set('tab', 'saved');

    if (state.query?.kind === 'area') {
        params.set('area', state.query.area);
    } else if (state.query?.kind === 'nearby') {
        params.set('lat', String(roundCoord(state.query.coordinates.lat)));
        params.set('lng', String(roundCoord(state.query.coordinates.lng)));
        params.set('r', String(state.query.radius));
    }

    if (state.cafeId) params.set('cafe', state.cafeId);

    const query = params.toString();
    return query ? `?${query}` : '';
}

/** クエリ文字列 → 状態。壊れた値は「指定なし」として無視する。 */
export function parseSearchParams(params: URLSearchParams): SearchUrlState {
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    const hasCoordinates =
        params.get('lat') !== null &&
        params.get('lng') !== null &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180;

    const area = params.get('area')?.trim() ?? '';

    let query: SearchQuery | null = null;
    if (hasCoordinates) {
        query = { kind: 'nearby', coordinates: { lat, lng }, radius: parseRadius(params.get('r')) };
    } else if (area) {
        query = { kind: 'area', area };
    }

    return {
        tab: params.get('tab') === 'saved' ? 'saved' : 'search',
        query,
        // `cafeId` は旧い共有リンクの形。後方互換で読むが、書き戻しは `cafe` に寄せる。
        cafeId: params.get('cafe') ?? params.get('cafeId'),
    };
}

function parseRadius(raw: string | null): SearchRadius {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_NEARBY_RADIUS;

    return (RADIUS_OPTIONS as readonly number[]).includes(value)
        ? (value as SearchRadius)
        : snapRadius(value);
}

/**
 * マウント時の URL のスナップショット。
 * 以降 URL は状態の写しなので読み直さない（読み直すと自分の書き戻しに反応してしまう）。
 */
export function useInitialSearchUrl(): SearchUrlState {
    const searchParams = useSearchParams();
    const [initial] = useState(() => parseSearchParams(new URLSearchParams(searchParams.toString())));
    return initial;
}

/**
 * 状態を URL に書き戻す。
 *
 * router.replace なので履歴は増えない（戻るボタンが検索のたびに詰まらない）。
 * 静的書き出しでも next/navigation の router はクライアント側で動く。
 */
export function useSearchUrlState(state: SearchUrlState): void {
    const router = useRouter();
    const target = buildSearchParams(state);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.location.search === target) return;

        router.replace(`${window.location.pathname}${target}`, { scroll: false });
    }, [target, router]);
}

/**
 * 共有用の絶対 URL。
 *
 * ネイティブアプリの origin は capacitor://localhost で共有先では開けないため、
 * iOS では NEXT_PUBLIC_WEB_BASE_URL（Pages の公開 URL）を土台にする。
 * 土台が分からなければ null を返し、呼び出し側が Google マップの URL に退避する。
 */
export function buildShareUrl(state: SearchUrlState): string | null {
    const base = isNativePlatform()
        ? process.env.NEXT_PUBLIC_WEB_BASE_URL?.replace(/\/$/, '')
        : typeof window === 'undefined'
          ? null
          : window.location.origin;

    if (!base) return null;

    return `${base}/${buildSearchParams(state)}`;
}

/**
 * URL に検索条件が載っていたら、1 回だけ同じ検索を投げ直して画面を復元する。
 * 共有リンクを開いたときとリロードしたときの両方がこれで戻る。
 */
export function useRestoreSearchFromUrl(
    initial: SearchUrlState,
    search: (query: SearchQuery) => void,
): void {
    const restored = useRef(false);

    useEffect(() => {
        if (restored.current || !initial.query) return;
        restored.current = true;
        search(initial.query);
    }, [initial, search]);
}

/**
 * 1 件のカフェを指す共有 URL。
 * 土台が分からない環境（NEXT_PUBLIC_WEB_BASE_URL 未設定の iOS など）では
 * Google マップの URL に退避する。共有できないよりはよい。
 */
export function buildCafeShareUrl(state: SearchUrlState, cafe: Cafe): string {
    return buildShareUrl({ ...state, cafeId: cafe.id }) ?? getCafeMapUrl(cafe);
}

/** 現在地検索の前に共有されたときの保険。逆ジオで引いた地名を検索条件の代わりにする。 */
export function areaQuery(areaName: string | null): SearchQuery | null {
    return areaName ? { kind: 'area', area: areaName } : null;
}
