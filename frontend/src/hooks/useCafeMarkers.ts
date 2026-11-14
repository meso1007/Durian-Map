'use client';

import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { useEffect, useRef } from 'react';
import { useApiIsLoaded, useMap } from '@vis.gl/react-google-maps';

import type { Cafe } from '@/lib/api';
import { getHoveredCafe, subscribeHoveredCafe } from '@/lib/hoverStore';
import {
    createCafePinIcon,
    createCafePinLabel,
    createClusterIcon,
    createClusterLabel,
    samePinData,
    toPinData,
} from '@/app/components/map/mapStyle';
import type { PinData } from '@/app/components/map/mapStyle';
import type { PinState } from '@/app/components/map/pinStyle';

const clusterRenderer: Renderer = {
    render({ count, position }) {
        return new google.maps.Marker({
            position,
            icon: createClusterIcon(),
            label: createClusterLabel(count),
            zIndex: 1000 + count,
        });
    },
};

const Z_INDEX: Record<PinState, number> = { default: 20, hover: 80, selected: 120 };

type MarkerEntry = { marker: google.maps.Marker; data: PinData; state: PinState };

function paint(entry: MarkerEntry): void {
    entry.marker.setIcon(createCafePinIcon(entry.data, entry.state));
    // label を消すときは null を渡す（undefined だと前の値が残る）。
    entry.marker.setLabel(createCafePinLabel(entry.data, entry.state));
    entry.marker.setZIndex(Z_INDEX[entry.state]);
}

/**
 * カフェのピン。
 *
 * id をキーに差分だけ更新する。結果や選択が変わるたびに全マーカーを作り直すと、
 * 20 件で目に見えて点滅し、WebView ではタップが遅れる。
 * 選択やホバーの切り替えで触るのは、状態が変わったピンだけ。
 */
export function useCafeMarkers({
    cafes,
    selectedId,
    savedIds,
    onSelectCafe,
}: {
    cafes: Cafe[];
    selectedId: string | null;
    /** 保存済みのカフェ。ピンの右上に印を付ける。 */
    savedIds: ReadonlySet<string>;
    onSelectCafe: (id: string) => void;
}) {
    const map = useMap();
    const isLoaded = useApiIsLoaded();

    const clustererRef = useRef<MarkerClusterer | null>(null);
    const entriesRef = useRef(new Map<string, MarkerEntry>());

    // クリックのたびに effect を作り直さないよう、最新の値だけ ref に持つ。
    const onSelectRef = useRef(onSelectCafe);
    const selectedIdRef = useRef(selectedId);
    useEffect(() => {
        onSelectRef.current = onSelectCafe;
        selectedIdRef.current = selectedId;
    }, [onSelectCafe, selectedId]);

    /** いまの選択とホバーから、そのピンの状態を決める。選択がホバーより優先。 */
    const stateOf = (id: string): PinState =>
        id === selectedIdRef.current ? 'selected' : id === getHoveredCafe() ? 'hover' : 'default';

    useEffect(() => {
        if (!map || !isLoaded) return;

        const clusterer = new MarkerClusterer({ map, renderer: clusterRenderer });
        clustererRef.current = clusterer;
        const entries = entriesRef.current;

        return () => {
            clusterer.clearMarkers();
            clusterer.setMap(null);
            clustererRef.current = null;

            entries.forEach(({ marker }) => {
                google.maps.event.clearInstanceListeners(marker);
                marker.setMap(null);
            });
            entries.clear();
        };
    }, [map, isLoaded]);

    // 結果・保存状態の差分を反映する。
    useEffect(() => {
        const clusterer = clustererRef.current;
        if (!map || !isLoaded || !clusterer) return;

        const entries = entriesRef.current;
        const valid = cafes.filter((cafe) => cafe.lat != null && cafe.lng != null);
        const nextIds = new Set(valid.map((cafe) => cafe.id));

        const added: google.maps.Marker[] = [];
        const removed: google.maps.Marker[] = [];

        entries.forEach(({ marker }, id) => {
            if (nextIds.has(id)) return;

            google.maps.event.clearInstanceListeners(marker);
            removed.push(marker);
            entries.delete(id);
        });

        valid.forEach((cafe) => {
            const position = { lat: cafe.lat!, lng: cafe.lng! };
            const data = toPinData(cafe, savedIds.has(cafe.id));
            const existing = entries.get(cafe.id);

            if (existing) {
                // 同じ店でも営業状態や保存は変わりうる。変わったときだけ描き直す。
                if (!samePinData(existing.data, data)) {
                    existing.data = data;
                    paint(existing);
                }
                existing.marker.setPosition(position);
                return;
            }

            const entry: MarkerEntry = {
                marker: new google.maps.Marker({ position, title: cafe.name }),
                data,
                state: stateOf(cafe.id),
            };
            paint(entry);

            entry.marker.addListener('click', () => onSelectRef.current(cafe.id));
            entries.set(cafe.id, entry);
            added.push(entry.marker);
        });

        if (removed.length > 0) {
            clusterer.removeMarkers(removed, true);
            removed.forEach((marker) => marker.setMap(null));
        }
        if (added.length > 0) clusterer.addMarkers(added, true);
        if (removed.length > 0 || added.length > 0) clusterer.render();
        // 選択とホバーは下の effect が担当する（stateOf は ref を読むだけ）。
    }, [cafes, savedIds, map, isLoaded]);

    // 選択とホバーの切り替え。状態が変わったピンだけを描き直す。
    useEffect(() => {
        if (!isLoaded) return;

        const sync = () => {
            entriesRef.current.forEach((entry, id) => {
                const next = stateOf(id);
                if (entry.state === next) return;

                entry.state = next;
                paint(entry);
            });
        };

        selectedIdRef.current = selectedId;
        sync();

        return subscribeHoveredCafe(sync);
    }, [selectedId, cafes, isLoaded]);
}
