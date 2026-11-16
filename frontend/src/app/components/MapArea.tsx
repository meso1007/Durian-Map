'use client';

import dynamic from 'next/dynamic';

import type { MapViewProps } from './MapView';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  // 地図が出るまでは陸地の色で埋めておく（白く抜けると、読み込みのたびに画面が明滅する）。
  loading: () => <div className="h-full w-full bg-map-land" aria-hidden />,
});

/**
 * 画面全体に敷く地図。検索バー・パネル・シートはこの上に浮く。
 *
 * `--dm-inset-*` は、Google のロゴと帰属表示を UI に隠れない位置へずらすための値
 * （globals.css の `.dm-map`）。地図を覆う面を足したら、ここに渡す insets も必ず見直すこと。
 */
export default function MapArea(props: MapViewProps) {
  const { insets } = props;

  return (
    <div
      className="dm-map absolute inset-0 z-0"
      style={
        {
          '--dm-inset-left': `${insets.left}px`,
          '--dm-inset-bottom': `${insets.bottom}px`,
        } as React.CSSProperties
      }
    >
      <MapView {...props} />
    </div>
  );
}
