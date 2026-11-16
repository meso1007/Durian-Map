'use client';

import { useCallback, useRef } from 'react';

import { nextSnap, resolveSnap, rubberBand } from '@/lib/sheet';
import type { SheetSnap } from '@/lib/sheet';

/** これ以上動かしたらドラッグとみなす（px）。未満はタップとして扱う。 */
const DRAG_THRESHOLD = 10;

/** ドラッグの直後、この時間に届いた click は捨てる（ms）。iOS は click を遅れて合成する。 */
const CLICK_SUPPRESS_MS = 350;

/** 速度は直近この時間ぶんの動きから出す（ms）。指を止めてから離したら 0 になる。 */
const VELOCITY_WINDOW = 90;

type Sample = { y: number; time: number };

/**
 * ボトムシートのドラッグ。
 *
 * シートの位置は CSS 変数 `--dm-sheet-visible`（見えている高さ）で決まる。段に止まっている間は
 * `data-snap` に応じた値を CSS が入れ、ドラッグ中だけここが px の実値で上書きする。
 * React の state を毎フレーム更新しないので、指への追従でカードが再描画されない。
 *
 * つかめるのはシートの頭（ハンドルと切り替えの行）。行の中のボタンのクリックを邪魔しないよう、
 * 動きがしきい値を超えるまではポインタを奪わない。
 */
export function useSheetDrag({
    snap,
    heights,
    enabled,
    onSnapChange,
}: {
    snap: SheetSnap;
    heights: Record<SheetSnap, number>;
    /** PC では false（シートはパネルになり、動かない）。 */
    enabled: boolean;
    onSnapChange: (next: SheetSnap) => void;
}) {
    const sheetRef = useRef<HTMLDivElement>(null);

    const drag = useRef<{
        pointerId: number;
        startY: number;
        startVisible: number;
        visible: number;
        active: boolean;
        samples: Sample[];
    } | null>(null);

    /** この時刻（event.timeStamp）までに届いた click は、ドラッグの終わりとして捨てる。 */
    const suppressClickUntil = useRef(0);

    const release = useCallback(() => {
        const sheet = sheetRef.current;
        if (!sheet) return;

        sheet.style.removeProperty('--dm-sheet-visible');
        sheet.style.removeProperty('--dm-sheet-body');
        delete sheet.dataset.dragging;
    }, []);

    const onPointerDown = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;

            // 段へ動いている途中でつかまれることがある。目標の高さではなく、いまの実際の高さから始める。
            const sheet = sheetRef.current;
            const visible = sheet ? window.innerHeight - sheet.getBoundingClientRect().top : heights[snap];

            drag.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
                startVisible: visible,
                visible,
                active: false,
                samples: [{ y: event.clientY, time: event.timeStamp }],
            };
        },
        [enabled, heights, snap],
    );

    const onPointerMove = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            const state = drag.current;
            const sheet = sheetRef.current;
            if (!state || !sheet || state.pointerId !== event.pointerId) return;

            const delta = state.startY - event.clientY;

            if (!state.active) {
                if (Math.abs(delta) < DRAG_THRESHOLD) return;

                state.active = true;
                sheet.dataset.dragging = 'true';
                event.currentTarget.setPointerCapture(event.pointerId);
            }

            state.visible = rubberBand(state.startVisible + delta, heights);
            state.samples.push({ y: event.clientY, time: event.timeStamp });
            if (state.samples.length > 8) state.samples.shift();

            const value = `${state.visible}px`;
            sheet.style.setProperty('--dm-sheet-visible', value);
            sheet.style.setProperty('--dm-sheet-body', value);
        },
        [heights],
    );

    const finish = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            const state = drag.current;
            if (!state || state.pointerId !== event.pointerId) return;

            drag.current = null;
            if (!state.active) return;

            suppressClickUntil.current = event.timeStamp + CLICK_SUPPRESS_MS;

            const recent = state.samples.filter((sample) => event.timeStamp - sample.time <= VELOCITY_WINDOW);
            const first = recent[0];
            const elapsed = first ? event.timeStamp - first.time : 0;
            const velocity = first && elapsed > 0 ? (first.y - event.clientY) / elapsed : 0;

            release();
            onSnapChange(resolveSnap(state.visible, velocity, heights));
        },
        [heights, onSnapChange, release],
    );

    const onClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
        if (event.timeStamp > suppressClickUntil.current) return;

        suppressClickUntil.current = 0;
        event.preventDefault();
        event.stopPropagation();
    }, []);

    /** ハンドルのボタン。キーボードと読み上げから段を変えられるようにする。 */
    const onHandleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                onSnapChange(snap === 'peek' ? 'half' : 'full');
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                onSnapChange(snap === 'full' ? 'half' : 'peek');
            }
        },
        [onSnapChange, snap],
    );

    return {
        sheetRef,
        /** シートの頭（つかめる領域）に付ける。 */
        dragProps: {
            onPointerDown,
            onPointerMove,
            onPointerUp: finish,
            onPointerCancel: finish,
            onClickCapture,
        },
        /** ハンドルのボタンに付ける。 */
        handleProps: {
            onClick: () => onSnapChange(nextSnap(snap)),
            onKeyDown: onHandleKeyDown,
        },
    };
}
