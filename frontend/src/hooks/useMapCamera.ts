'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

import type { Cafe, Coordinates } from '@/lib/api';
import type { MapInsets } from '@/lib/layout';

/** 結果全体を収めるとき、UI に覆われていない領域の内側にさらに取る余白（px）。ピンの札が端で切れないように。 */
const FIT_MARGIN = 56;

/** 1 件に寄るときの最小ズーム。 */
const FOCUS_ZOOM = 16;

/** 結果が 0 件で現在地へ寄せるときのズーム。 */
const LOCATION_ZOOM = 15;

/** UI に覆われていない領域がこれより狭いときは、余白を諦めて地図全体で収める（px）。 */
const MIN_VISIBLE_SIDE = 160;

/**
 * 地図の視点。
 *
 * 地図は全面に敷いてあり、その一部をパネルやシートが覆っている。
 * 「見えている領域」の中央に寄せないと、選んだ店がパネルの下に入る。
 *
 * 動かすのは次の 2 つのときだけ。それ以外（並び替え・保存・絞り込みで 0 件・読み込み中・
 * 選択の解除）では、ユーザーが合わせた視点をそのまま残す。
 * - 表示する店の顔ぶれが変わった → 全体が見えている領域に収まるようにする
 * - 店を選んだ → その店を見えている領域の中央へ寄せる
 */
export function useMapCamera({
    cafes,
    selectedId,
    currentLocation,
    includeCurrentLocation,
    searchToken,
    insets,
}: {
    cafes: Cafe[];
    selectedId: string | null;
    currentLocation: Coordinates | null;
    /**
     * 結果を収めるときに現在地も入れるか。現在地からの検索のときだけ true にする。
     * エリア検索で入れると、東京にいる人が「京都」を探したときに東京〜京都が 1 画面に収まってしまう。
     */
    includeCurrentLocation: boolean;
    /** 検索が完了するたびに増える値。0 件だったときに現在地へ寄せる合図に使う。 */
    searchToken: number;
    insets: MapInsets;
}) {
    const map = useMap();

    // 視点を動かすきっかけにしたくない値は ref で最新だけ持つ
    // （シートの段が変わるたび・現在地が遅れて届くたびに地図が動くと落ち着かない）。
    const latest = useRef({ cafes, selectedId, currentLocation, includeCurrentLocation, insets });
    useEffect(() => {
        latest.current = { cafes, selectedId, currentLocation, includeCurrentLocation, insets };
    });

    // 「顔ぶれ」は id の集合で比べる。配列の作り直しや並び替えでは変わらない。
    const idsKey = cafes
        .filter(hasPosition)
        .map((cafe) => cafe.id)
        .sort()
        .join(',');

    const previousToken = useRef(searchToken);

    // 顔ぶれが変わった / 検索が完了した。
    useEffect(() => {
        if (!map) return;

        const searchCompleted = previousToken.current !== searchToken;
        previousToken.current = searchToken;

        const state = latest.current;
        const valid = state.cafes.filter(hasPosition);

        if (state.selectedId) {
            // 選択中の店が一覧に居るなら、そこに寄せたままにする（共有リンクの復元もここを通る）。
            // 一覧から消えた場合（保存の解除など）は詳細がまだ開いているので、視点は動かさない。
            const target = valid.find((cafe) => cafe.id === state.selectedId);
            if (target) focusOn(map, toCoordinates(target), state.insets);
            return;
        }

        if (valid.length === 0) {
            // 読み込み中や絞り込みで 0 件になっただけなら動かさない。
            // 現在地からの検索が 0 件で終わったときだけ、現在地を見せる。
            if (searchCompleted && state.includeCurrentLocation && state.currentLocation) {
                focusOn(map, state.currentLocation, state.insets, LOCATION_ZOOM);
            }
            return;
        }

        // 1 軒だけ（保存が 1 軒のときなど）を fitBounds に渡すと、1 点に合わせて最大まで拡大され、
        // 道も地名も無い絵になる。店を選んだときと同じ寄せ方にする。
        if (valid.length === 1 && !(state.includeCurrentLocation && state.currentLocation)) {
            focusOn(map, toCoordinates(valid[0]), state.insets, FOCUS_ZOOM);
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        if (state.includeCurrentLocation && state.currentLocation) bounds.extend(state.currentLocation);
        valid.forEach((cafe) => bounds.extend(toCoordinates(cafe)));

        map.fitBounds(bounds, fitPadding(map, state.insets));
    }, [idsKey, searchToken, map]);

    // 店を選んだ。
    useEffect(() => {
        if (!map || !selectedId) return;

        const target = latest.current.cafes.filter(hasPosition).find((cafe) => cafe.id === selectedId);
        if (target) focusOn(map, toCoordinates(target), latest.current.insets);
    }, [selectedId, map]);
}

type PositionedCafe = Cafe & { lat: number; lng: number };

function hasPosition(cafe: Cafe): cafe is PositionedCafe {
    return cafe.lat != null && cafe.lng != null;
}

function toCoordinates(cafe: PositionedCafe): Coordinates {
    return { lat: cafe.lat, lng: cafe.lng };
}

/** fitBounds の余白。覆われている帯 + 内側の余白。領域が狭すぎるときは余白を諦める。 */
function fitPadding(map: google.maps.Map, insets: MapInsets): google.maps.Padding {
    const element = map.getDiv();
    const visibleWidth = element.clientWidth - insets.left - insets.right;
    const visibleHeight = element.clientHeight - insets.top - insets.bottom;

    if (visibleWidth < MIN_VISIBLE_SIDE || visibleHeight < MIN_VISIBLE_SIDE) {
        return { top: 24, right: 24, bottom: 24, left: 24 };
    }

    // 余白が見えている領域を食い潰すと、極端に引いた絵になる。短辺の 1/5 までに抑える。
    const margin = Math.min(FIT_MARGIN, Math.floor(Math.min(visibleWidth, visibleHeight) / 5));

    return {
        top: insets.top + margin,
        right: insets.right + margin,
        bottom: insets.bottom + margin,
        left: insets.left + margin,
    };
}

/**
 * 「見えている領域の中央」と「地図の中心」のずれ（px）。
 * 見えている領域の中央は、地図の中心から右へ x、下へ y の位置にある。
 */
function visibleOffset(insets: MapInsets): { x: number; y: number } {
    return { x: (insets.left - insets.right) / 2, y: (insets.top - insets.bottom) / 2 };
}

/**
 * 地点を px だけずらす。ずらす量は px なので、メルカトルの世界座標
 * （ズーム 0 で 256px 四方、y は下向き）に直して計算する。投影がまだ無ければ null。
 */
function shiftByPixels(
    map: google.maps.Map,
    position: Coordinates,
    zoom: number,
    dx: number,
    dy: number,
): Coordinates | null {
    const projection = map.getProjection();
    const point = projection?.fromLatLngToPoint(new google.maps.LatLng(position.lat, position.lng));
    if (!projection || !point) return null;

    const scale = 2 ** zoom;
    const shifted = projection.fromPointToLatLng(new google.maps.Point(point.x + dx / scale, point.y + dy / scale));

    return shifted ? { lat: shifted.lat(), lng: shifted.lng() } : null;
}

/** 見えている領域の中央にある地点。再検索の中心や、拡大・縮小の基準に使う。 */
export function getVisibleCenter(map: google.maps.Map, insets: MapInsets): Coordinates | null {
    const center = map.getCenter();
    const zoom = map.getZoom();
    if (!center || zoom == null) return null;

    const position = { lat: center.lat(), lng: center.lng() };
    const { x, y } = visibleOffset(insets);

    return shiftByPixels(map, position, zoom, x, y) ?? position;
}

/**
 * 指定した地点を「見えている領域」の中央へ寄せる。
 * 地図の中心は画面全体の中央なので、その分だけ中心を逆向きにずらす。
 *
 * @param zoom 省略すると、いまのズーム（ただし FOCUS_ZOOM 以上）のまま寄せる
 */
export function focusOn(map: google.maps.Map, position: Coordinates, insets: MapInsets, zoom?: number): void {
    const targetZoom = zoom ?? Math.max(map.getZoom() ?? FOCUS_ZOOM, FOCUS_ZOOM);

    // 地図の初期化が終わる前（共有リンクを開いた直後など）は投影がまだ無い。用意できてからやり直す。
    if (!map.getProjection()) {
        google.maps.event.addListenerOnce(map, 'projection_changed', () => focusOn(map, position, insets, zoom));
        return;
    }

    if (map.getZoom() !== targetZoom) map.setZoom(targetZoom);

    const { x, y } = visibleOffset(insets);
    map.panTo(shiftByPixels(map, position, targetZoom, -x, -y) ?? position);
}
