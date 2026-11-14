'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

import type { Cafe, Coordinates } from '@/lib/api';
import type { MapInsets } from '@/lib/layout';

/** 結果全体を収めるとき、UI に覆われていない領域の内側にさらに取る余白（px）。ピンの札が端で切れないように。 */
const FIT_MARGIN = 56;

/** 1 件に寄るときの最小ズーム。 */
const FOCUS_ZOOM = 16;

/** UI に覆われていない領域がこれより狭いときは、余白を諦めて地図全体で収める（px）。 */
const MIN_VISIBLE_SIDE = 160;

/**
 * 地図の視点。
 *
 * 地図は全面に敷いてあり、その一部をパネルやシートが覆っている。
 * 「見えている領域」の中央に寄せないと、選んだ店がパネルの下に入る。
 *
 * - 結果が変わったら、結果全体が見えている領域に収まるようにする
 * - 店を選んだら、その店を見えている領域の中央へ寄せる
 * - 選択を解いたときは動かさない（一覧に戻るたびに地図が引くと落ち着かない）
 */
export function useMapCamera({
    cafes,
    selectedId,
    currentLocation,
    insets,
}: {
    cafes: Cafe[];
    selectedId: string | null;
    currentLocation: Coordinates | null;
    insets: MapInsets;
}) {
    const map = useMap();

    // シートの段が変わるたびに視点を動かしたくないので、覆われ方は ref で最新だけ持つ。
    const insetsRef = useRef(insets);
    useEffect(() => {
        insetsRef.current = insets;
    }, [insets]);

    const previous = useRef<{ cafes: Cafe[] | null; selectedId: string | null }>({ cafes: null, selectedId: null });

    useEffect(() => {
        if (!map) return;

        const cafesChanged = previous.current.cafes !== cafes;
        const selectionChanged = previous.current.selectedId !== selectedId;
        previous.current = { cafes, selectedId };

        const valid = cafes.filter((cafe) => cafe.lat != null && cafe.lng != null);
        const target = selectedId ? valid.find((cafe) => cafe.id === selectedId) : undefined;

        if (target) {
            focus(map, { lat: target.lat!, lng: target.lng! }, insetsRef.current);
            return;
        }

        // 選択を解いただけ。視点はそのまま。
        if (selectionChanged && !cafesChanged) return;

        if (valid.length === 0) {
            if (currentLocation) {
                map.setZoom(15);
                focus(map, currentLocation, insetsRef.current, 15);
            }
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        if (currentLocation) bounds.extend(currentLocation);
        valid.forEach((cafe) => bounds.extend({ lat: cafe.lat!, lng: cafe.lng! }));

        map.fitBounds(bounds, fitPadding(map, insetsRef.current));
    }, [cafes, selectedId, currentLocation, map]);
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
 * 指定した地点を「見えている領域」の中央へ寄せる。
 *
 * 地図の中心は画面全体の中央なので、覆われている帯の差の半分だけ中心をずらす。
 * ずらす量は px なので、メルカトルの世界座標（ズーム 0 で 256px 四方）に直して計算する。
 */
function focus(map: google.maps.Map, position: Coordinates, insets: MapInsets, zoomOverride?: number): void {
    const zoom = zoomOverride ?? Math.max(map.getZoom() ?? FOCUS_ZOOM, FOCUS_ZOOM);
    const projection = map.getProjection();

    if (zoomOverride === undefined && map.getZoom() !== zoom) map.setZoom(zoom);

    if (!projection) {
        map.panTo(position);
        return;
    }

    const point = projection.fromLatLngToPoint(new google.maps.LatLng(position.lat, position.lng));
    if (!point) {
        map.panTo(position);
        return;
    }

    const scale = 2 ** zoom;
    const shifted = new google.maps.Point(
        point.x - (insets.left - insets.right) / 2 / scale,
        point.y + (insets.bottom - insets.top) / 2 / scale,
    );

    const center = projection.fromPointToLatLng(shifted);
    map.panTo(center ?? position);
}
