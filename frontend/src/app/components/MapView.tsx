'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useApiIsLoaded, useMap } from '@vis.gl/react-google-maps';

// 型の正は lib/api.ts（API のレスポンスと一致させる）
import type { Cafe, Coordinates } from '@/lib/api';
import { distanceBetween } from '@/lib/geo';
import { snapRadius } from '@/hooks/useCafeSearch';
import type { SearchRadius } from '@/hooks/useCafeSearch';
import { useCafeMarkers } from '@/hooks/useCafeMarkers';
import { useMapCamera } from '@/hooks/useMapCamera';

import { CURRENT_LOCATION_DOT, CURRENT_LOCATION_RING, MAP_STYLE } from './map/mapStyle';
import { SearchIcon } from './icons';

/** これ以上動かしたら「このエリアで再検索」を出す。 */
const RESEARCH_THRESHOLD_METERS = 300;

type Props = {
  cafes: Cafe[];
  selectedId: string | null;
  currentLocation: Coordinates | null;
  emphasizeCurrentLocation: boolean;
  /** 検索が完了するたびに変わる値。地図が「検索直後の視点」を覚え直す合図。 */
  searchToken: number;
  onSelectCafe: (id: string) => void;
  onClearSelection: () => void;
  /** 「このエリアで再検索」。表示中の範囲から半径を出して渡す。 */
  onSearchThisArea: (center: Coordinates, radius: SearchRadius) => void;
  onError: (message: string) => void;
};

export default function MapView({
  cafes,
  selectedId,
  currentLocation,
  emphasizeCurrentLocation,
  searchToken,
  onSelectCafe,
  onClearSelection,
  onSearchThisArea,
  onError,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const defaultCenter = currentLocation ?? { lat: 35.6762, lng: 139.6503 };
  const defaultZoom = currentLocation ? 15 : 13;

  const handleApiError = useCallback(() => onError('地図を読み込めませんでした。'), [onError]);

  if (!apiKey) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-sunken px-6 text-center text-sm leading-[1.6] text-text-muted">
        マップを表示するには NEXT_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。
      </div>
    );
  }

  return (
    // version は固定する。既定の weekly は破壊的変更が黙って降ってくる。
    <APIProvider apiKey={apiKey} version="quarterly" onError={handleApiError}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        styles={MAP_STYLE}
        disableDefaultUI
        zoomControl={false}
        mapTypeControl={false}
        scaleControl={false}
        streetViewControl={false}
        rotateControl={false}
        fullscreenControl={false}
        cameraControl={false}
        keyboardShortcuts={false}
        gestureHandling="greedy"
        className="h-full w-full"
        onClick={onClearSelection}
      >
        <MapLayers
          cafes={cafes}
          selectedId={selectedId}
          currentLocation={currentLocation}
          emphasizeCurrentLocation={emphasizeCurrentLocation}
          onSelectCafe={onSelectCafe}
        />
        <ResearchPrompt searchToken={searchToken} onSearchThisArea={onSearchThisArea} />
      </Map>
    </APIProvider>
  );
}

/** <Map> の子でしか useMap() が使えないので、フックはここでまとめて呼ぶ。 */
function MapLayers({
  cafes,
  selectedId,
  currentLocation,
  emphasizeCurrentLocation,
  onSelectCafe,
}: {
  cafes: Cafe[];
  selectedId: string | null;
  currentLocation: Coordinates | null;
  emphasizeCurrentLocation: boolean;
  onSelectCafe: (id: string) => void;
}) {
  useMapCamera({ cafes, selectedId, currentLocation, emphasizeCurrentLocation });
  useCafeMarkers({ cafes, selectedId, onSelectCafe });

  return <CurrentLocationMarker currentLocation={currentLocation} />;
}

function CurrentLocationMarker({ currentLocation }: { currentLocation: Coordinates | null }) {
  const isLoaded = useApiIsLoaded();
  if (!isLoaded || !currentLocation) return null;

  const ring: google.maps.Symbol = { path: google.maps.SymbolPath.CIRCLE, ...CURRENT_LOCATION_RING };
  const dot: google.maps.Symbol = { path: google.maps.SymbolPath.CIRCLE, ...CURRENT_LOCATION_DOT };

  return (
    <>
      <Marker position={currentLocation} icon={ring} clickable={false} zIndex={6} />
      <Marker position={currentLocation} icon={dot} clickable={false} zIndex={7} />
    </>
  );
}

/**
 * 「このエリアで再検索」のピル。
 *
 * 検索直後の中心を基準に覚え、そこから 300m 以上動かしたら出す。
 * Google マップと同じ探索の流れ（動かす → その場所で探し直す）を作るためのもので、
 * 最重要 CTA（近くからさがす）とぶつからないよう Secondary の見た目にする
 * （最重要 CTA は 1 画面 1 つ / docs/design.md 1節）。
 */
function ResearchPrompt({
  searchToken,
  onSearchThisArea,
}: {
  searchToken: number;
  onSearchThisArea: (center: Coordinates, radius: SearchRadius) => void;
}) {
  const map = useMap();
  const [visible, setVisible] = useState(false);
  const baselineRef = useRef<Coordinates | null>(null);
  // 次に静止したときの中心を基準として取り直す（検索直後は fitBounds が走る）。
  const resetBaselineRef = useRef(true);

  useEffect(() => {
    if (!map) return;

    // 検索が終わるたびに基準を取り直す。直後に fitBounds が走るので、
    // その結果落ち着いた位置が「検索したエリア」になる。
    resetBaselineRef.current = true;

    const listener = map.addListener('idle', () => {
      const center = map.getCenter();
      if (!center) return;

      const position = { lat: center.lat(), lng: center.lng() };

      if (resetBaselineRef.current || !baselineRef.current) {
        baselineRef.current = position;
        resetBaselineRef.current = false;
        setVisible(false);
        return;
      }

      setVisible(distanceBetween(baselineRef.current, position) >= RESEARCH_THRESHOLD_METERS);
    });

    return () => listener.remove();
  }, [map, searchToken]);

  const handleClick = () => {
    const center = map?.getCenter();
    if (!map || !center) return;

    setVisible(false);
    onSearchThisArea({ lat: center.lat(), lng: center.lng() }, viewportRadius(map));
  };

  return (
    <>
      {visible && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
          <button
            type="button"
            onClick={handleClick}
            className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-bold text-text shadow-card"
          >
            <SearchIcon className="w-4 h-4" />
            このエリアで再検索
          </button>
        </div>
      )}
    </>
  );
}

/**
 * 表示中の範囲から検索半径を出す。
 *
 * 短辺の半分を採り、API が受け付ける値に丸める。長辺で採ると画面外まで
 * 検索してしまい、結果が地図に収まらない。
 */
function viewportRadius(map: google.maps.Map): SearchRadius {
  const bounds = map.getBounds();
  const center = map.getCenter();
  if (!bounds || !center) return snapRadius(1500);

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  const width = distanceBetween({ lat: center.lat(), lng: sw.lng() }, { lat: center.lat(), lng: ne.lng() });
  const height = distanceBetween({ lat: sw.lat(), lng: center.lng() }, { lat: ne.lat(), lng: center.lng() });

  return snapRadius(Math.min(width, height) / 2);
}
