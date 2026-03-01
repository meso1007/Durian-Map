'use client';

import { useEffect } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps';

type Cafe = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
};

// ダーク・ミニマルなカスタムマップスタイル
const MAP_STYLE = [
  // ベース背景
  { elementType: 'geometry',           stylers: [{ color: '#1c1f26' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1c1f26' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#6b7280' }] },

  // 建物・影を非表示
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },

  // POI（施設アイコン・ラベル）を非表示
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },

  // 交通機関を非表示
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // 細かい道を非表示
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },

  // 幹線道路は薄く表示
  { featureType: 'road.arterial', elementType: 'geometry',         stylers: [{ color: '#2a2f3a' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },

  // 国道・高速はやや明るく
  { featureType: 'road.highway', elementType: 'geometry',         stylers: [{ color: '#333a47' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },

  // 水域を深い紺色に
  { featureType: 'water', elementType: 'geometry',         stylers: [{ color: '#0d1117' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1e3a5f' }] },

  // 自然地形
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#1a1d24' }] },

  // 行政境界を非表示（区境の線）
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },

  // 市区町村名だけ薄く残す
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
];

// ---- マーカー画像の設定 ----
// frontend/public/ に画像を置いて、パスをここで変更するだけで差し替え可能
const MARKER_ICON = '/marker.png';          // 通常時
const MARKER_ICON_SELECTED = '/marker-selected.png'; // 選択時（同じ画像でも可）
const MARKER_SIZE = 36;           // 通常サイズ (px)
const MARKER_SIZE_SELECTED = 46; // 選択時サイズ (px)
// --------------------------

// マップのパン・フィット制御
function MapController({ cafes, selectedId }: { cafes: Cafe[]; selectedId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const valid = cafes.filter(c => c.lat != null && c.lng != null);
    if (valid.length === 0) return;

    if (selectedId) {
      const target = valid.find(c => c.id === selectedId);
      if (target) {
        map.panTo({ lat: target.lat!, lng: target.lng! });
        return;
      }
    }

    const bounds = new google.maps.LatLngBounds();
    valid.forEach(c => bounds.extend({ lat: c.lat!, lng: c.lng! }));
    map.fitBounds(bounds, 60);
  }, [cafes, selectedId, map]);

  return null;
}

// ハートマーカー群（APIロード後に描画）
function CafeMarkers({ cafes, selectedId, onSelectCafe }: {
  cafes: Cafe[];
  selectedId: string | null;
  onSelectCafe: (id: string) => void;
}) {
  const isLoaded = useApiIsLoaded();
  if (!isLoaded) return null;

  return (
    <>
      {cafes.filter(c => c.lat != null && c.lng != null).map(cafe => {
        const selected = cafe.id === selectedId;
        const size = selected ? MARKER_SIZE_SELECTED : MARKER_SIZE;
        const icon: google.maps.Icon = {
          url: selected ? MARKER_ICON_SELECTED : MARKER_ICON,
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size),
        };
        return (
          <Marker
            key={cafe.id}
            position={{ lat: cafe.lat!, lng: cafe.lng! }}
            icon={icon}
            onClick={() => onSelectCafe(cafe.id)}
          />
        );
      })}
    </>
  );
}

type Props = {
  cafes: Cafe[];
  selectedId: string | null;
  onSelectCafe: (id: string) => void;
};

export default function MapView({ cafes, selectedId, onSelectCafe }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={{ lat: 35.6762, lng: 139.6503 }}
        defaultZoom={12}
        // @ts-ignore – styles prop is valid MapOptions
        styles={MAP_STYLE}
        disableDefaultUI
        gestureHandling="greedy"
        className="w-full h-full"
      >
        <MapController cafes={cafes} selectedId={selectedId} />
        <CafeMarkers cafes={cafes} selectedId={selectedId} onSelectCafe={onSelectCafe} />
      </Map>
    </APIProvider>
  );
}
