'use client';

import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { useEffect, useRef } from 'react';
import { useApiIsLoaded, useMap } from '@vis.gl/react-google-maps';

import type { Cafe } from '@/lib/api';
import { createCafeMarkerIcon } from '@/app/components/map/mapStyle';

const clusterRenderer: Renderer = {
    render({ count, position }) {
        const svg = window.btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="24" fill="#FFF7E6" />
        <circle cx="32" cy="32" r="20" fill="#A8CF3B" />
      </svg>
    `);

        return new google.maps.Marker({
            position,
            icon: {
                url: `data:image/svg+xml;base64,${svg}`,
                scaledSize: new google.maps.Size(56, 56),
            },
            label: { text: String(count), color: '#1F3218', fontSize: '13px', fontWeight: '700' },
            zIndex: 1000 + count,
        });
    },
};

const Z_INDEX_DEFAULT = 20;
const Z_INDEX_SELECTED = 120;

type MarkerEntry = { marker: google.maps.Marker; openNow?: boolean };

/**
 * カフェのピン。
 *
 * id をキーに差分だけ更新する。以前は結果や選択が変わるたびに全マーカーを
 * 破棄・再生成していて、20 件で目に見えて点滅し、WebView ではタップが遅れていた。
 * 選択の切り替えでは該当する 2 個の setIcon / setZIndex しか触らない。
 */
export function useCafeMarkers({
    cafes,
    selectedId,
    onSelectCafe,
}: {
    cafes: Cafe[];
    selectedId: string | null;
    onSelectCafe: (id: string) => void;
}) {
    const map = useMap();
    const isLoaded = useApiIsLoaded();

    const clustererRef = useRef<MarkerClusterer | null>(null);
    const entriesRef = useRef(new Map<string, MarkerEntry>());
    const appliedSelectionRef = useRef<string | null>(null);

    // クリックのたびに effect を作り直さないよう、最新のハンドラだけ持つ。
    const onSelectRef = useRef(onSelectCafe);
    useEffect(() => {
        onSelectRef.current = onSelectCafe;
    }, [onSelectCafe]);

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
            appliedSelectionRef.current = null;
        };
    }, [map, isLoaded]);

    // 結果の差分を反映する。
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
            const existing = entries.get(cafe.id);

            if (existing) {
                // 同じ店でも営業状態は検索のたびに変わりうる。変わったときだけ描き直す。
                if (existing.openNow !== cafe.openNow) {
                    existing.marker.setIcon(createCafeMarkerIcon(cafe.openNow, cafe.id === selectedId));
                    existing.openNow = cafe.openNow;
                }
                existing.marker.setPosition(position);
                return;
            }

            const isSelected = cafe.id === selectedId;
            const marker = new google.maps.Marker({
                position,
                title: cafe.name,
                icon: createCafeMarkerIcon(cafe.openNow, isSelected),
                zIndex: isSelected ? Z_INDEX_SELECTED : Z_INDEX_DEFAULT,
            });

            marker.addListener('click', () => onSelectRef.current(cafe.id));
            entries.set(cafe.id, { marker, openNow: cafe.openNow });
            added.push(marker);
        });

        if (removed.length > 0) {
            clusterer.removeMarkers(removed, true);
            removed.forEach((marker) => marker.setMap(null));
        }
        if (added.length > 0) clusterer.addMarkers(added, true);
        if (removed.length > 0 || added.length > 0) clusterer.render();
        // selectedId は新規マーカーの初期アイコンにしか使わない。
        // 選択の切り替えは下の effect が担当する。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cafes, map, isLoaded]);

    // 選択の切り替え。触るのは「前に選ばれていたピン」と「今選ばれたピン」だけ。
    useEffect(() => {
        if (!isLoaded) return;

        const entries = entriesRef.current;
        const previousId = appliedSelectionRef.current;
        if (previousId === selectedId) return;

        const previous = previousId ? entries.get(previousId) : undefined;
        if (previous) {
            previous.marker.setIcon(createCafeMarkerIcon(previous.openNow, false));
            previous.marker.setZIndex(Z_INDEX_DEFAULT);
        }

        const current = selectedId ? entries.get(selectedId) : undefined;
        if (current) {
            current.marker.setIcon(createCafeMarkerIcon(current.openNow, true));
            current.marker.setZIndex(Z_INDEX_SELECTED);
        }

        appliedSelectionRef.current = selectedId;
    }, [selectedId, cafes, isLoaded]);
}
