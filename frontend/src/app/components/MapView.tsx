'use client';

import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useApiIsLoaded,
  useMap,
} from '@vis.gl/react-google-maps';

type Cafe = {
  id: string;
  name: string;
  address: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  openNow?: boolean;
  photoName?: string;
  lat?: number;
  lng?: number;
};

type Coordinates = {
  lat: number;
  lng: number;
};

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#182015' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#182015' }] },
  { elementType: 'labels.text', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#76866a' }] },

  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#273120' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#324022' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#11180f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#39514a' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#1c2717' }] },

  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];

const MARKER_ICON = '/marker.svg';
const MARKER_ICON_SELECTED = '/marker-selected.svg';
const MARKER_SIZE = 42;
const MARKER_SIZE_SELECTED = 52;

const createCafeMarkerIcon = (selected: boolean, sizeOverride?: number): google.maps.Icon => {
  const size = sizeOverride ?? (selected ? MARKER_SIZE_SELECTED : MARKER_SIZE);

  return {
    url: selected ? MARKER_ICON_SELECTED : MARKER_ICON,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size),
  };
};

const clusterRenderer: Renderer = {
  render({ count, position }) {
    const svg = window.btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="24" fill="#365018" opacity="0.22" />
        <circle cx="32" cy="32" r="21" fill="#A5D449" />
        <circle cx="32" cy="32" r="17" fill="#F4D964" />
      </svg>
    `);

    return new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml;base64,${svg}`,
        scaledSize: new google.maps.Size(56, 56),
      },
      label: {
        text: String(count),
        color: '#274017',
        fontSize: '13px',
        fontWeight: '800',
      },
      zIndex: 1000 + count,
    });
  },
};

function MapController({
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

    const validCafes = cafes.filter((cafe) => cafe.lat != null && cafe.lng != null);

    if (selectedId) {
      const targetCafe = validCafes.find((cafe) => cafe.id === selectedId);
      if (targetCafe) {
        map.panTo({ lat: targetCafe.lat!, lng: targetCafe.lng! });
        map.setZoom(Math.max(map.getZoom() ?? 16, 16));
        return;
      }
    }

    if (validCafes.length === 0) {
      if (currentLocation) {
        map.panTo(currentLocation);
        map.setZoom(15);
      }
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    if (emphasizeCurrentLocation && currentLocation) {
      bounds.extend(currentLocation);
    }
    validCafes.forEach((cafe) => bounds.extend({ lat: cafe.lat!, lng: cafe.lng! }));
    map.fitBounds(bounds, 72);
  }, [cafes, selectedId, currentLocation, emphasizeCurrentLocation, map]);

  return null;
}

function CafeMarkers({
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
  const markersRef = useRef<google.maps.Marker[]>([]);
  const selectedMarkerRef = useRef<google.maps.Marker | null>(null);
  const selectionAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !isLoaded) return;

    clustererRef.current = new MarkerClusterer({
      map,
      renderer: clusterRenderer,
    });

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current?.setMap(null);
      clustererRef.current = null;

      markersRef.current.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker);
        marker.setMap(null);
      });
      markersRef.current = [];

      if (selectedMarkerRef.current) {
        google.maps.event.clearInstanceListeners(selectedMarkerRef.current);
        selectedMarkerRef.current.setMap(null);
        selectedMarkerRef.current = null;
      }

      if (selectionAnimationRef.current) {
        window.cancelAnimationFrame(selectionAnimationRef.current);
        selectionAnimationRef.current = null;
      }
    };
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded || !clustererRef.current) return;

    const validCafes = cafes.filter((cafe) => cafe.lat != null && cafe.lng != null);
    const selectedCafe = selectedId ? validCafes.find((cafe) => cafe.id === selectedId) ?? null : null;
    const clusteredCafes = selectedCafe
      ? validCafes.filter((cafe) => cafe.id !== selectedCafe.id)
      : validCafes;

    clustererRef.current.clearMarkers(true);
    markersRef.current.forEach((marker) => {
      google.maps.event.clearInstanceListeners(marker);
      marker.setMap(null);
    });

    markersRef.current = clusteredCafes.map((cafe) => {
      const marker = new google.maps.Marker({
        position: { lat: cafe.lat!, lng: cafe.lng! },
        title: cafe.name,
        icon: createCafeMarkerIcon(false),
        zIndex: 20,
      });

      marker.addListener('click', () => onSelectCafe(cafe.id));
      return marker;
    });

    if (markersRef.current.length > 0) {
      clustererRef.current.addMarkers(markersRef.current, true);
    }
    clustererRef.current.render();

    if (selectedMarkerRef.current) {
      google.maps.event.clearInstanceListeners(selectedMarkerRef.current);
      selectedMarkerRef.current.setMap(null);
      selectedMarkerRef.current = null;
    }

    if (selectionAnimationRef.current) {
      window.cancelAnimationFrame(selectionAnimationRef.current);
      selectionAnimationRef.current = null;
    }

    if (selectedCafe) {
      const startSize = MARKER_SIZE + 2;
      const selectedMarker = new google.maps.Marker({
        map,
        position: { lat: selectedCafe.lat!, lng: selectedCafe.lng! },
        title: selectedCafe.name,
        icon: createCafeMarkerIcon(true, startSize),
        zIndex: 120,
        opacity: 0.82,
      });

      selectedMarker.addListener('click', () => onSelectCafe(selectedCafe.id));
      selectedMarkerRef.current = selectedMarker;

      const animationStart = window.performance.now();
      const animationDuration = 180;
      const step = (timestamp: number) => {
        const progress = Math.min((timestamp - animationStart) / animationDuration, 1);
        const eased = 1 - ((1 - progress) ** 3);
        const currentSize = startSize + ((MARKER_SIZE_SELECTED - startSize) * eased);

        selectedMarker.setIcon(createCafeMarkerIcon(true, Math.round(currentSize)));
        selectedMarker.setOpacity(0.82 + (0.18 * eased));

        if (progress < 1) {
          selectionAnimationRef.current = window.requestAnimationFrame(step);
          return;
        }

        selectionAnimationRef.current = null;
      };

      selectionAnimationRef.current = window.requestAnimationFrame(step);
    }
  }, [cafes, selectedId, isLoaded, map, onSelectCafe]);

  return null;
}

function CurrentLocationMarker({ currentLocation }: { currentLocation: Coordinates | null }) {
  const isLoaded = useApiIsLoaded();
  if (!isLoaded || !currentLocation) return null;

  const ring: google.maps.Symbol = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: '#60A5FA',
    fillOpacity: 0.2,
    strokeColor: '#BFDBFE',
    strokeOpacity: 0.95,
    strokeWeight: 1,
    scale: 18,
  };

  const dot: google.maps.Symbol = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: '#2563EB',
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeOpacity: 1,
    strokeWeight: 3,
    scale: 7,
  };

  return (
    <>
      <Marker position={currentLocation} icon={ring} clickable={false} zIndex={6} />
      <Marker position={currentLocation} icon={dot} clickable={false} zIndex={7} />
    </>
  );
}

type Props = {
  cafes: Cafe[];
  selectedId: string | null;
  currentLocation: Coordinates | null;
  emphasizeCurrentLocation: boolean;
  onSelectCafe: (id: string) => void;
  onClearSelection: () => void;
};

export default function MapView({
  cafes,
  selectedId,
  currentLocation,
  emphasizeCurrentLocation,
  onSelectCafe,
  onClearSelection,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={{ lat: 35.6762, lng: 139.6503 }}
        defaultZoom={12}
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
        <MapController
          cafes={cafes}
          selectedId={selectedId}
          currentLocation={currentLocation}
          emphasizeCurrentLocation={emphasizeCurrentLocation}
        />
        <CurrentLocationMarker currentLocation={currentLocation} />
        <CafeMarkers cafes={cafes} selectedId={selectedId} onSelectCafe={onSelectCafe} />
      </Map>
    </APIProvider>
  );
}
