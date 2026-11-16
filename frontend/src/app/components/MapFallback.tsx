'use client';

import { useMemo, useSyncExternalStore } from 'react';

import type { Cafe, Coordinates } from '@/lib/api';
import { getHoveredCafe, setHoveredCafe, subscribeHoveredCafe } from '@/lib/hoverStore';
import type { MapInsets } from '@/lib/layout';

import { PIN_SAVED_COLOR, getFeaturedIds, getPinColors, showsRating } from './map/pinStyle';
import type { PinState } from './map/pinStyle';
import { StarIcon } from './icons';

type Props = {
  cafes: Cafe[];
  selectedId: string | null;
  savedIds: ReadonlySet<string>;
  currentLocation: Coordinates | null;
  insets: MapInsets;
  /** 地図を出せない理由。文言を変える。 */
  reason: 'missing-key' | 'load-error';
  onSelectCafe: (id: string) => void;
  onClearSelection: () => void;
};

/** 見えている領域の内側に取る余白（%）。ピンの札が端で切れないように。 */
const MARGIN = 12;

type Placed = { cafe: Cafe; x: number; y: number };

/**
 * 地図を出せないときの代替表示。
 *
 * 地図タイルは無いが、店どうしの位置関係は緯度経度から描ける。一覧と詳細はそのまま使えるので、
 * 「地図が壊れたらアプリ全体が使えない」状態にはしない（docs/design.md 4.5節）。
 * 地図のキーを置いていない開発環境でも、画面の骨格と重なりをここで確認できる。
 */
export default function MapFallback({
  cafes,
  selectedId,
  savedIds,
  currentLocation,
  insets,
  reason,
  onSelectCafe,
  onClearSelection,
}: Props) {
  const hoveredId = useSyncExternalStore(subscribeHoveredCafe, getHoveredCafe, () => null);

  const { placed, here } = useMemo(() => project(cafes, currentLocation), [cafes, currentLocation]);
  const featuredIds = useMemo(() => getFeaturedIds(cafes), [cafes]);

  return (
    <div className="absolute inset-0 bg-map-land" onClick={onClearSelection}>
      {/* UI に覆われていない領域。ピンはこの中に収める。 */}
      <div
        className="absolute"
        style={{ top: insets.top + 32, right: insets.right, bottom: insets.bottom, left: insets.left }}
      >
        {here && (
          <span
            aria-hidden
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-info"
            style={{ left: `${here.x}%`, top: `${here.y}%` }}
          />
        )}

        {placed.map(({ cafe, x, y }) => {
          const state: PinState = cafe.id === selectedId ? 'selected' : cafe.id === hoveredId ? 'hover' : 'default';
          const colors = getPinColors(cafe.openNow, state);
          const featured = featuredIds.has(cafe.id);
          const pill = showsRating(cafe.rating, featured, state) && cafe.rating != null;

          return (
            <button
              key={cafe.id}
              type="button"
              // 一覧のカードと同じ店を指すので、読み上げとタブ移動は一覧側に任せる。
              tabIndex={-1}
              aria-hidden
              onClick={(event) => {
                event.stopPropagation();
                onSelectCafe(cafe.id);
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') setHoveredCafe(cafe.id);
              }}
              onPointerLeave={() => setHoveredCafe(null)}
              // 押せる領域は 44px。見た目（札 / 小さな丸）は中の span が持つ。
              className="absolute flex h-11 min-w-11 items-center justify-center"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                // 選択 > ホバー > 札 > 丸。札は地図の上で唯一の文字情報なので、丸に隠させない。
                zIndex: state === 'selected' ? 4 : state === 'hover' ? 3 : featured ? 2 : 1,
              }}
            >
              <span
                className={`num relative flex items-center justify-center gap-1 rounded-full font-medium leading-none transition-transform duration-[var(--dm-duration-fast)] ease-out ${pill ? 'h-7 border-2 px-2 text-sm' : 'h-5 w-5 border-[2.5px]'}`}
                style={{
                  backgroundColor: colors.fill,
                  borderColor: colors.stroke,
                  color: colors.text,
                  transform: `scale(${state === 'selected' ? 1.2 : 1})`,
                }}
              >
                {pill ? (
                  <>
                    <StarIcon className="h-4 w-4" />
                    {cafe.rating!.toFixed(1)}
                  </>
                ) : (
                  <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: colors.stroke }} />
                )}
                {savedIds.has(cafe.id) && (
                  <span
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2"
                    style={{ backgroundColor: PIN_SAVED_COLOR, borderColor: colors.fill }}
                  />
                )}
              </span>
            </button>
          );
        })}

        <p className="absolute bottom-3 left-1/2 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-full bg-surface px-3 py-2 text-center text-xs leading-[1.5] text-text-muted shadow-card">
          {reason === 'missing-key'
            ? '地図のキーが未設定のため、位置関係だけを表示しています。'
            : '地図を読み込めませんでした。一覧からさがせます。'}
        </p>
      </div>
    </div>
  );
}

/**
 * 緯度経度を 0〜100% の座標に直す。
 * 経度は緯度の余弦で縮める（東京付近では経度 1 度のほうが緯度 1 度より短い）。
 */
function project(cafes: Cafe[], currentLocation: Coordinates | null): { placed: Placed[]; here: { x: number; y: number } | null } {
  const valid = cafes.filter((cafe) => cafe.lat != null && cafe.lng != null);
  const points = [
    ...valid.map((cafe) => ({ lat: cafe.lat!, lng: cafe.lng! })),
    ...(currentLocation ? [currentLocation] : []),
  ];

  if (points.length === 0) return { placed: [], here: null };

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);

  const squeeze = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const spanX = Math.max((east - west) * squeeze, 1e-6);
  const spanY = Math.max(north - south, 1e-6);
  const usable = 100 - MARGIN * 2;

  const place = (point: Coordinates) => ({
    x: points.length === 1 ? 50 : MARGIN + (((point.lng - west) * squeeze) / spanX) * usable,
    y: points.length === 1 ? 50 : MARGIN + ((north - point.lat) / spanY) * usable,
  });

  return {
    placed: valid.map((cafe) => ({ cafe, ...place({ lat: cafe.lat!, lng: cafe.lng! }) })),
    here: currentLocation ? place(currentLocation) : null,
  };
}
