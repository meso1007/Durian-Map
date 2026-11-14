/**
 * View Transitions API の薄い包み。一覧のカードの写真を、詳細の大きな写真へつなぐのに使う。
 *
 * 対応していないブラウザと「動きを減らす」設定では、そのまま更新するだけ（見た目が変わらず壊れもしない）。
 */

import { flushSync } from 'react-dom';

type TransitionDocument = Document & {
    startViewTransition?: (update: () => void) => {
        finished: Promise<void>;
        ready: Promise<void>;
        updateCallbackDone: Promise<void>;
    };
};

/** 一覧と詳細で同じ写真であることを示す名前。同時に 2 つの要素へ付けないこと（遷移が中断される）。 */
export const CAFE_PHOTO_TRANSITION = 'cafe-photo';

/**
 * `update` の前後の画面をブラウザに比べさせ、同じ名前の要素を滑らかにつなぐ。
 * `update` の中の state 更新は flushSync で同期的に DOM へ反映する（遷移後の姿を撮らせるため）。
 */
export function withViewTransition(update: () => void, onFinished?: () => void): void {
    const doc = document as TransitionDocument;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!doc.startViewTransition || reduced) {
        update();
        onFinished?.();
        return;
    }

    const transition = doc.startViewTransition(() => flushSync(update));
    // 遷移が飛ばされると ready などが reject される。画面は更新済みなので、握りつぶしてよい。
    transition.ready.catch(() => undefined);
    transition.updateCallbackDone.catch(() => undefined);
    // 中断された場合も後始末は必ず行う。
    void transition.finished.catch(() => undefined).then(() => onFinished?.());
}

/** 一覧の中の、指定したカフェのカードの写真枠。 */
export function findCardPhoto(root: ParentNode | null, cafeId: string): HTMLElement | null {
    return root?.querySelector<HTMLElement>(`[data-id="${CSS.escape(cafeId)}"] [data-photo]`) ?? null;
}
