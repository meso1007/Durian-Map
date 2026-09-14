'use client';

import dynamic from 'next/dynamic';

import type { Cafe, Coordinates } from '@/lib/api';
import { getDistanceMeters } from '@/lib/geo';
import type { SearchRadius } from '@/hooks/useCafeSearch';
import type { SelectionSource } from '@/hooks/useMapSelection';

import type { SheetState } from './BottomSheet';
import MapSelectionCard from './MapSelectionCard';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-sunken" aria-hidden />,
});

type Props = {
  cafes: Cafe[];
  selectedId: string | null;
  selectedCafe: Cafe | null;
  selectionSource: SelectionSource | null;
  currentLocation: Coordinates | null;
  emphasizeCurrentLocation: boolean;
  searchToken: number;
  sheetState: SheetState;
  onSelectCafe: (id: string) => void;
  onClearSelection: () => void;
  onSearchThisArea: (center: Coordinates, radius: SearchRadius) => void;
  onError: (message: string) => void;
};

/**
 * 地図とその上に重なるカード。
 * 高さはシートの開き具合で決まる（% で持つ。dvh と vh を混ぜると iOS で地図が消える）。
 */
export default function MapArea({
  cafes,
  selectedId,
  selectedCafe,
  selectionSource,
  currentLocation,
  emphasizeCurrentLocation,
  searchToken,
  sheetState,
  onSelectCafe,
  onClearSelection,
  onSearchThisArea,
  onError,
}: Props) {
  return (
    <div
      className={`absolute inset-x-0 top-0 z-0 overflow-hidden md:static md:inset-auto md:flex-1
        ${sheetState === 'full' ? 'bottom-[88%]' : 'bottom-[52%]'}`}
    >
      <MapView
        cafes={cafes}
        selectedId={selectedId}
        currentLocation={currentLocation}
        emphasizeCurrentLocation={emphasizeCurrentLocation}
        searchToken={searchToken}
        onSelectCafe={onSelectCafe}
        onClearSelection={onClearSelection}
        onSearchThisArea={onSearchThisArea}
        onError={onError}
      />

      {selectedCafe && selectionSource === 'map' && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 md:hidden">
          <div className="pointer-events-auto">
            <MapSelectionCard
              cafe={selectedCafe}
              distance={getDistanceMeters(currentLocation, selectedCafe)}
              onClose={onClearSelection}
            />
          </div>
        </div>
      )}
    </div>
  );
}
