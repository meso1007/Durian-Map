'use client';

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

import type { Cafe, Coordinates } from '@/lib/api';

/**
 * 地図の視点。選択中の店があればそこへ寄せ、無ければ結果全体が収まるようにする。
 */
export function useMapCamera({
    cafes,
    selectedId,
    currentLocation,
    emphasizeCurrentLocation,
}: {
    cafes: Cafe[];
    selectedId: string | null;
    currentLocation: Coordinates | null;
    emphasizeCurrentLocation: boolean;
}) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        const valid = cafes.filter((cafe) => cafe.lat != null && cafe.lng != null);

        if (selectedId) {
            const target = valid.find((cafe) => cafe.id === selectedId);
            if (target) {
                map.panTo({ lat: target.lat!, lng: target.lng! });
                map.setZoom(Math.max(map.getZoom() ?? 16, 16));
                return;
            }
        }

        if (valid.length === 0) {
            if (currentLocation) {
                map.panTo(currentLocation);
                map.setZoom(15);
            }
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        if (currentLocation) bounds.extend(currentLocation);
        valid.forEach((cafe) => bounds.extend({ lat: cafe.lat!, lng: cafe.lng! }));

        // 余白が地図の高さを食い潰すと fitBounds は極端に引いた絵になる。
        // ボトムシートが開いていると地図は 100px 程度まで縮むので、短辺に対して上限をかける。
        const desired = emphasizeCurrentLocation && currentLocation ? 96 : 72;
        const element = map.getDiv();
        const shortSide = Math.min(element.clientWidth || 0, element.clientHeight || 0);
        const padding = shortSide > 0 ? Math.max(8, Math.min(desired, Math.floor(shortSide * 0.18))) : desired;

        map.fitBounds(bounds, padding);
    }, [cafes, selectedId, currentLocation, emphasizeCurrentLocation, map]);
}
