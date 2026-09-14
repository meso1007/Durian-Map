'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Cafe } from '@/lib/api';

/** 地図のピンから選んだのか、リストのカードから選んだのか。出す UI が変わる。 */
export type SelectionSource = 'map' | 'list';

/** PC では地図とリストを同期させる（Tailwind の md と同じ 768px）。 */
function isDesktop(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
}

/**
 * カフェの選択状態と、リストのスクロール同期。
 *
 * スクロールは「対象カードが DOM に現れたら寄せる」。setTimeout で待つと、
 * 検索直後（カードがまだ描画されていない）に空振りする。
 * 寄せたい id は ref に置く — 描画のたびに確認したいだけで、値が変わっても
 * 再描画する必要はないため。
 */
export function useMapSelection(initialSelectedId: string | null = null) {
    const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
    const [selectionSource, setSelectionSource] = useState<SelectionSource | null>(
        initialSelectedId ? 'list' : null,
    );

    const listRef = useRef<HTMLDivElement>(null);
    const scrollTargetRef = useRef<string | null>(initialSelectedId);

    const select = useCallback((id: string, source: SelectionSource) => {
        setSelectedId(id);
        setSelectionSource(source);

        // 地図から選んだとき、モバイルは地図上のカードで見せるのでリストは動かさない
        // （シートが半分閉じているのに裏でスクロールしても意味がない）。
        if (source === 'list' || isDesktop()) scrollTargetRef.current = id;
    }, []);

    const clear = useCallback(() => {
        setSelectedId(null);
        setSelectionSource(null);
        scrollTargetRef.current = null;
    }, []);

    /**
     * 詳細パネルを閉じる。フォーカスは元のカードへ戻す。
     * 戻さないと、キーボード / 読み上げの利用者はページ先頭に放り出される。
     */
    const dismiss = useCallback(() => {
        const previousId = selectedId;
        clear();

        if (!previousId) return;

        // パネルが消えてカードが並び直るのを待ってからフォーカスする。
        window.requestAnimationFrame(() => {
            const card = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(previousId)}"]`);
            card?.focus({ preventScroll: true });
        });
    }, [selectedId, clear]);

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

    return { selectedId, selectionSource, listRef, select, clear, dismiss };
}

/**
 * 詳細パネルに出すカフェ。
 *
 * 一覧から消えても、選択が解けるまでは直前の内容を保持する。
 * 保存タブで「保存を解除」したとたんパネルが消えると、解除を取り消せない
 * （押した直後に対象が無くなるのは、押せるのに効かない UI と同じくらい悪い）。
 */
export function useSelectedCafe(selectedId: string | null, cafes: Cafe[]): Cafe | null {
    const [snapshot, setSnapshot] = useState<Cafe | null>(null);
    const found = selectedId ? (cafes.find((cafe) => cafe.id === selectedId) ?? null) : null;

    // 描画中の調整（effect にすると 1 フレーム古い内容が見える）。
    if (found && found !== snapshot) {
        setSnapshot(found);
    } else if (!selectedId && snapshot) {
        setSnapshot(null);
    }

    return selectedId ? (found ?? snapshot) : null;
}
