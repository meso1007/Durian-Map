'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 地図のピンから選んだのか、リストのカードから選んだのか。出す UI が変わる。 */
export type SelectionSource = 'map' | 'list';

/**
 * カフェの選択状態と、リストのスクロール同期。
 *
 * スクロールは「対象カードが DOM に現れたら寄せる」。setTimeout で待つと、
 * 検索直後（カードがまだ描画されていない）に空振りする。
 * 寄せたい id は ref に置く — 描画のたびに確認したいだけで、値が変わっても
 * 再描画する必要はないため。
 */
export function useMapSelection() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectionSource, setSelectionSource] = useState<SelectionSource | null>(null);

    const listRef = useRef<HTMLDivElement>(null);
    const scrollTargetRef = useRef<string | null>(null);

    const select = useCallback((id: string, source: SelectionSource, scrollList = true) => {
        setSelectedId(id);
        setSelectionSource(source);
        if (scrollList) scrollTargetRef.current = id;
    }, []);

    const clear = useCallback(() => {
        setSelectedId(null);
        setSelectionSource(null);
        scrollTargetRef.current = null;
    }, []);

    // 依存配列を持たせない（= 毎描画後に確認する）のは意図的。
    // カードが現れるのが何度目の描画かは事前に分からない。
    useEffect(() => {
        const id = scrollTargetRef.current;
        if (!id) return;

        const card = listRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (!card) return;

        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        scrollTargetRef.current = null;
    });

    return { selectedId, selectionSource, listRef, select, clear };
}
