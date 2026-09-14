'use client';

import { useCallback, useMemo, useState } from 'react';

import type { Cafe, Coordinates } from '@/lib/api';
import { matchesPriceFilters } from '@/lib/cafe';
import type { PriceFilterId } from '@/lib/cafe';
import { getDistanceMeters } from '@/lib/geo';
import type { SavedCafe, SavedStatus } from '@/lib/storage';

import type { TabId } from '@/app/components/TabBar';

export type SavedFilter = 'all' | SavedStatus;

/**
 * 一覧に出すカフェの絞り込みと並び替え。
 *
 * チップは押した分だけ実際に効かせる（見た目だけのフィルタは作らない /
 * docs/design.md 1節）ので、絞り込みの条件と結果はここに閉じている。
 */
export function useCafeFilters({
    tab,
    results,
    savedCafes,
    currentLocation,
}: {
    tab: TabId;
    results: Cafe[];
    savedCafes: SavedCafe[];
    currentLocation: Coordinates | null;
}) {
    const [openNowOnly, setOpenNowOnly] = useState(false);
    const [priceFilters, setPriceFilters] = useState<PriceFilterId[]>([]);
    const [savedFilter, setSavedFilter] = useState<SavedFilter>('all');
    const [sortByDistance, setSortByDistance] = useState(false);

    const toggleOpenNow = useCallback(() => setOpenNowOnly((value) => !value), []);
    const toggleSort = useCallback(() => setSortByDistance((value) => !value), []);
    const togglePrice = useCallback(
        (id: PriceFilterId) =>
            setPriceFilters((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])),
        [],
    );

    // 現在地が無ければ距離が出せないので、並び替えも成立しない。
    const canSortByDistance = currentLocation !== null;

    const cafes = useMemo(() => {
        const base: Cafe[] =
            tab === 'search'
                ? results.filter(
                      (cafe) => (!openNowOnly || cafe.openNow === true) && matchesPriceFilters(cafe, priceFilters),
                  )
                : savedCafes.filter((cafe) => savedFilter === 'all' || cafe.status === savedFilter);

        if (!canSortByDistance || !sortByDistance) return base;

        return [...base].sort((a, b) => {
            const da = getDistanceMeters(currentLocation, a);
            const db = getDistanceMeters(currentLocation, b);
            if (da === null) return 1;
            if (db === null) return -1;
            return da - db;
        });
    }, [tab, results, savedCafes, openNowOnly, priceFilters, savedFilter, sortByDistance, canSortByDistance, currentLocation]);

    const savedCounts = useMemo(
        () => ({
            all: savedCafes.length,
            want: savedCafes.filter((cafe) => cafe.status === 'want').length,
            visited: savedCafes.filter((cafe) => cafe.status === 'visited').length,
        }),
        [savedCafes],
    );

    return {
        cafes,
        openNowOnly,
        toggleOpenNow,
        priceFilters,
        togglePrice,
        savedFilter,
        setSavedFilter,
        sortByDistance,
        toggleSort,
        canSortByDistance,
        activeFilterCount: (openNowOnly ? 1 : 0) + priceFilters.length,
        savedCounts,
    };
}
