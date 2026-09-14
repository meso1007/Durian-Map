'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, searchCafes } from '@/lib/api';
import type { Cafe, Coordinates } from '@/lib/api';

/** 現在地からの検索か、エリア名からの検索か。 */
export type SearchMode = 'area' | 'nearby';

/** 検索半径。API 側が受け付ける値と一致させること（backend の z.enum）。 */
export const RADIUS_OPTIONS = [500, 1000, 1500, 3000, 5000] as const;
export type SearchRadius = (typeof RADIUS_OPTIONS)[number];

export const DEFAULT_NEARBY_RADIUS: SearchRadius = 1500;

/** 任意の半径を API が受け付ける値に丸める。 */
export function snapRadius(meters: number): SearchRadius {
    return RADIUS_OPTIONS.reduce((best, option) =>
        Math.abs(option - meters) < Math.abs(best - meters) ? option : best,
    );
}

/**
 * 何を検索したか。URL に載る形と 1 対 1 に対応させてあるので、
 * これがそのまま共有リンクとリロード時の復元に使える。
 */
export type SearchQuery =
    | { kind: 'area'; area: string }
    | { kind: 'nearby'; coordinates: Coordinates; radius: SearchRadius };

/**
 * 検索の状態。「読み込み中なのに結果がある」のような表現できない組み合わせを
 * 型で潰すため、個別の boolean ではなく判別共用体にしてある。
 */
export type CafeSearchState =
    | { status: 'idle' }
    | { status: 'loading'; mode: SearchMode }
    | { status: 'success'; mode: SearchMode; results: Cafe[] }
    | { status: 'error'; mode: SearchMode; message: string };

const GENERIC_ERROR = 'カフェの検索に失敗しました。しばらく経ってから再度お試しください。';

/**
 * カフェ検索。
 *
 * 連打や「現在地で検索」と手入力が重なると応答順が入れ替わりうるので、
 * 新しい検索を始めた時点で前の fetch を abort し、さらに世代 ID で
 * 「abort が間に合わなかった応答」も捨てる（二重の防御）。
 */
export function useCafeSearch(onError: (message: string) => void) {
    const [state, setState] = useState<CafeSearchState>({ status: 'idle' });

    /** 直近に投げた検索条件。URL への書き戻しと共有リンクが参照する。 */
    const [query, setQuery] = useState<SearchQuery | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const generationRef = useRef(0);

    /** 検索が 1 回完了するたびに増える。地図側が「検索直後の視点」を知るのに使う。 */
    const [completedCount, setCompletedCount] = useState(0);

    useEffect(() => () => abortRef.current?.abort(), []);

    const search = useCallback(
        async (request: SearchQuery) => {
            if (request.kind === 'area' && !request.area.trim()) return;

            const mode: SearchMode = request.kind === 'nearby' ? 'nearby' : 'area';
            setQuery(normalizeQuery(request));

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            const generation = ++generationRef.current;
            setState({ status: 'loading', mode });

            try {
                const results = await searchCafes(
                    request.kind === 'nearby'
                        ? { category: 'カフェ', location: request.coordinates, radius: request.radius }
                        : { category: 'カフェ', area: request.area.trim() },
                    controller.signal,
                );

                if (generation !== generationRef.current) return;

                setState({ status: 'success', mode, results });
                setCompletedCount((count) => count + 1);
            } catch (error) {
                // 新しい検索に追い越された場合。ユーザーには何も起きていない。
                if (controller.signal.aborted || generation !== generationRef.current) return;

                // ApiError のメッセージはそのままユーザーに見せてよい
                // （レート制限・予算超過などサーバーが日本語で返す）。
                const message = error instanceof ApiError ? error.message : GENERIC_ERROR;
                setState({ status: 'error', mode, message });
                onError(message);
            }
        },
        [onError],
    );

    return {
        state,
        query,
        search,
        completedCount,
        results: state.status === 'success' ? state.results : EMPTY_RESULTS,
        isLoading: state.status === 'loading',
        hasSearched: state.status !== 'idle',
    };
}

const EMPTY_RESULTS: Cafe[] = [];

/** 前後の空白など、URL に載せる前に整える。 */
function normalizeQuery(query: SearchQuery): SearchQuery {
    return query.kind === 'area' ? { kind: 'area', area: query.area.trim() } : query;
}
