/**
 * 「いまポインタが載っているカフェ」の小さなストア。
 *
 * 一覧のカードと地図のピンを対応づけるために使う。React の state にすると、
 * ポインタが動くたびに画面全体（カード 20 枚 + 地図）が再描画されるので、
 * 必要な側だけが購読できる形にしてある。
 */

type Listener = (id: string | null) => void;

let hoveredId: string | null = null;
const listeners = new Set<Listener>();

export function setHoveredCafe(id: string | null): void {
    if (hoveredId === id) return;

    hoveredId = id;
    listeners.forEach((listener) => listener(id));
}

export function getHoveredCafe(): string | null {
    return hoveredId;
}

export function subscribeHoveredCafe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
