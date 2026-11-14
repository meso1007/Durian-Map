'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useApiIsLoaded, useMap } from '@vis.gl/react-google-maps';

// 型の正は lib/api.ts（API のレスポンスと一致させる）
import type { Cafe, Coordinates } from '@/lib/api';
import { distanceBetween } from '@/lib/geo';
import type { MapInsets } from '@/lib/layout';
import { snapRadius } from '@/hooks/useCafeSearch';
import type { SearchRadius } from '@/hooks/useCafeSearch';
import { useCafeMarkers } from '@/hooks/useCafeMarkers';
import { useMapCamera } from '@/hooks/useMapCamera';

import MapFallback from './MapFallback';
import { CURRENT_LOCATION_DOT, CURRENT_LOCATION_RING, MAP_BACKGROUND, MAP_STYLE } from './map/mapStyle';
import { SearchIcon } from './icons';

/** これ以上動かしたら「このエリアで再検索」を出す。 */
const RESEARCH_THRESHOLD_METERS = 300;

/** 位置が分からないうちの初期表示（東京）。 */
const DEFAULT_CENTER: Coordinates = { lat: 35.6762, lng: 139.6503 };

export type MapViewProps = {
  cafes: Cafe[];
  selectedId: string | null;
  savedIds: ReadonlySet<string>;
  currentLocation: Coordinates | null;
  /** 地図のうち UI が覆っている帯。視点とピンの収め方に使う。 */
  insets: MapInsets;
  /** 検索が完了するたびに変わる値。地図が「検索直後の視点」を覚え直す合図。 */
  searchToken: number;
  onSelectCafe: (id: string) => void;
  onClearSelection: () => void;
  /** 「このエリアで再検索」。表示中の範囲から半径を出して渡す。 */
  onSearchThisArea: (center: Coordinates, radius: SearchRadius) => void;
  onError: (message: string) => void;
};

export default function MapView(props: MapViewProps) {
  const { cafes, selectedId, savedIds, currentLocation, insets, searchToken, onSelectCafe, onClearSelection, onSearchThisArea, onError } = props;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const [failed, setFailed] = useState(false);

  const handleApiError = useCallback(() => {
    setFailed(true);
    onError('地図を読み込めませんでした。一覧からさがせます。');
  }, [onError]);

  // キーが無い・読み込みに失敗した。位置関係だけの代替表示に倒す（一覧と詳細は使える）。
  if (!apiKey || failed) {
    return (
      <MapFallback
        cafes={cafes}
        selectedId={selectedId}
        savedIds={savedIds}
        currentLocation={currentLocation}
        insets={insets}
        reason={apiKey ? 'load-error' : 'missing-key'}
        onSelectCafe={onSelectCafe}
        onClearSelection={onClearSelection}
      />
    );
  }

  return (
    // version は固定する。既定の weekly は破壊的変更が黙って降ってくる。
    <APIProvider apiKey={apiKey} version="quarterly" language="ja" region="JP" onError={handleApiError}>
      <Map
        defaultCenter={currentLocation ?? DEFAULT_CENTER}
        defaultZoom={currentLocation ? 15 : 13}
        styles={MAP_STYLE}
        backgroundColor={MAP_BACKGROUND}
        disableDefaultUI
        clickableIcons={false}
        keyboardShortcuts={false}
        gestureHandling="greedy"
        className="h-full w-full"
        onClick={onClearSelection}
      >
        <MapLayers
          cafes={cafes}
          selectedId={selectedId}
          savedIds={savedIds}
          currentLocation={currentLocation}
          insets={insets}
          onSelectCafe={onSelectCafe}
        />
        <ResearchPrompt searchToken={searchToken} insets={insets} onSearchThisArea={onSearchThisArea} />
      </Map>
    </APIProvider>
  );
}

/** <Map> の子でしか useMap() が使えないので、フックはここでまとめて呼ぶ。 */
function MapLayers({
  cafes,
  selectedId,
  savedIds,
  currentLocation,
  insets,
  onSelectCafe,
}: Pick<MapViewProps, 'cafes' | 'selectedId' | 'savedIds' | 'currentLocation' | 'insets' | 'onSelectCafe'>) {
  useMapCamera({ cafes, selectedId, currentLocation, insets });
  useCafeMarkers({ cafes, selectedId, savedIds, onSelectCafe });

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
 * 最重要 CTA（近くからさがす）とぶつからないよう Secondary の見た目にする
 * （最重要 CTA は 1 画面 1 つ / docs/design.md 1節）。
 * 置く場所は、UI に覆われていない領域の上端の中央。
 */
function ResearchPrompt({
  searchToken,
  insets,
  onSearchThisArea,
}: Pick<MapViewProps, 'searchToken' | 'insets' | 'onSearchThisArea'>) {
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

  // 検索は 1 回以上済んでいること（初回表示では「再」検索にならない）。
  if (!visible || searchToken === 0) return null;

  const handleClick = () => {
    const center = map?.getCenter();
    if (!map || !center) return;

    setVisible(false);
    onSearchThisArea({ lat: center.lat(), lng: center.lng() }, viewportRadius(map, insets));
  };

  return (
    <div
      className="pointer-events-none absolute z-20 flex justify-center px-4"
      style={{ top: insets.top + 12, left: insets.left, right: insets.right }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="pointer-events-auto inline-flex min-h-11 animate-pop items-center gap-2 rounded-full bg-surface px-4 text-sm font-bold text-text shadow-float transition-transform duration-[var(--dm-duration-fast)] active:scale-95"
      >
        <SearchIcon className="h-4 w-4" />
        このエリアで再検索
      </button>
    </div>
  );
}

/**
 * 表示中の範囲から検索半径を出す。
 *
 * UI に覆われていない領域の短辺の半分を採り、API が受け付ける値に丸める。
 * 長辺や画面全体で採ると見えていない所まで検索してしまい、結果がパネルの下に入る。
 */
function viewportRadius(map: google.maps.Map, insets: MapInsets): SearchRadius {
  const bounds = map.getBounds();
  const center = map.getCenter();
  if (!bounds || !center) return snapRadius(1500);

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const element = map.getDiv();

  const fullWidth = distanceBetween({ lat: center.lat(), lng: sw.lng() }, { lat: center.lat(), lng: ne.lng() });
  const fullHeight = distanceBetween({ lat: sw.lat(), lng: center.lng() }, { lat: ne.lat(), lng: center.lng() });

  // 画面全体の距離に「見えている割合」を掛ける。
  const widthRatio = element.clientWidth > 0 ? Math.max(0.2, 1 - (insets.left + insets.right) / element.clientWidth) : 1;
  const heightRatio = element.clientHeight > 0 ? Math.max(0.2, 1 - (insets.top + insets.bottom) / element.clientHeight) : 1;

  return snapRadius(Math.min(fullWidth * widthRatio, fullHeight * heightRatio) / 2);
}
