'use client';

import { useMemo, useState } from 'react';

import { parseHourRanges } from '@/lib/cafe';
import type { DayHours, HourRange } from '@/lib/cafe';

/** 文字盤の寸法（viewBox 200×200）。 */
const CENTER = 100;
const RING_RADIUS = 76;
const RING_WIDTH = 16;
const DAY_MINUTES = 1440;

/** いまの時刻（JST、0:00 からの分）。端末のタイムゾーンに関係なく JST で出す。 */
function getJstMinutes(now: number): number {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

/** 24 時間で 1 周する文字盤の上の点。0 時が真上、時計回り。 */
function pointAt(minutes: number, radius: number): { x: number; y: number } {
  const angle = ((minutes % DAY_MINUTES) / DAY_MINUTES) * Math.PI * 2;
  return { x: CENTER + radius * Math.sin(angle), y: CENTER - radius * Math.cos(angle) };
}

/** 開いている時間帯の弧。日をまたぐ営業（end が 24 時を超える）は、そのまま 0 時をまたいで描く。 */
function arcPath({ start, end }: HourRange): string {
  const length = Math.min(end - start, DAY_MINUTES);
  // ちょうど 1 周は始点と終点が重なって描けないので、わずかに手前で止める。
  const stop = start + (length >= DAY_MINUTES ? DAY_MINUTES - 0.5 : length);
  const from = pointAt(start, RING_RADIUS);
  const to = pointAt(stop, RING_RADIUS);

  return `M ${from.x} ${from.y} A ${RING_RADIUS} ${RING_RADIUS} 0 ${length > DAY_MINUTES / 2 ? 1 : 0} 1 ${to.x} ${to.y}`;
}

const HOUR_MARKS = [0, 6, 12, 18];

/**
 * 営業時間を、24 時間で 1 周する時計の文字盤で出す。
 *
 * 輪の塗ってある所が開いている時間、針が「いま」。朝の店は右上、夜の店は左側が塗られ、
 * 深夜営業は 0 時をまたいで続く — 文字で読まなくても、その店が「いつの店か」が形で分かる。
 * 下の曜日を押すと、その曜日の文字盤に切り替わる（初期表示は今日）。
 * → docs/design.md 5節「詳細」
 */
export default function WeekHours({ rows, now }: { rows: DayHours[]; now: number }) {
  const todayIndex = Math.max(0, rows.findIndex((row) => row.isToday));
  const [selectedIndex, setSelectedIndex] = useState(todayIndex);

  const days = useMemo(() => rows.map((row) => ({ ...row, ranges: parseHourRanges(row.hours) })), [rows]);
  const selected = days[selectedIndex];

  const nowMinutes = getJstMinutes(now);
  const hand = pointAt(nowMinutes, RING_RADIUS - RING_WIDTH / 2 - 6);

  return (
    <section className="mt-6" aria-label="営業時間">
      <h3 className="text-xs text-text-muted">営業時間</h3>

      <div className="mt-2 flex items-center gap-5">
        <svg viewBox="0 0 200 200" className="h-36 w-36 shrink-0" aria-hidden focusable="false">
          {/* 輪（1 日）。 */}
          <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} fill="none" strokeWidth={RING_WIDTH} className="stroke-surface-sunken" />

          {/* 開いている時間帯。 */}
          {selected.ranges.map((range) => (
            <path
              key={range.start}
              d={arcPath(range)}
              fill="none"
              strokeWidth={RING_WIDTH}
              strokeLinecap="round"
              className={selected.isToday ? 'stroke-primary' : 'stroke-primary-soft'}
            />
          ))}

          {/* 1 時間ごとの目盛りと、6 時間ごとの数字。 */}
          {Array.from({ length: 24 }, (_, hour) => {
            const outer = pointAt(hour * 60, RING_RADIUS - RING_WIDTH / 2 - 3);
            const inner = pointAt(hour * 60, RING_RADIUS - RING_WIDTH / 2 - (hour % 6 === 0 ? 9 : 6));
            return (
              <line
                key={hour}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                strokeWidth={hour % 6 === 0 ? 2 : 1}
                strokeLinecap="round"
                className="stroke-border"
              />
            );
          })}
          {HOUR_MARKS.map((hour) => {
            const position = pointAt(hour * 60, RING_RADIUS - RING_WIDTH / 2 - 21);
            return (
              <text
                key={hour}
                x={position.x}
                y={position.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="num fill-text-muted text-[13px]"
              >
                {hour}
              </text>
            );
          })}

          {/* 針（いま）。今日の文字盤にだけ出す。 */}
          {selected.isToday && (
            <>
              <line x1={CENTER} y1={CENTER} x2={hand.x} y2={hand.y} strokeWidth={3} strokeLinecap="round" className="stroke-cta-deep" />
              <circle cx={CENTER} cy={CENTER} r={5} className="fill-cta-deep" />
            </>
          )}
          {!selected.isToday && <circle cx={CENTER} cy={CENTER} r={3} className="fill-border" />}
        </svg>

        {/* 選んだ曜日の時刻。曜日を押すたびに読み上げる。 */}
        <p aria-live="polite" className="min-w-0 text-sm text-text-muted">
          <span className="block">
            {selected.day}曜日
            {selected.isToday && '（今日）'}
          </span>
          <span className={`mt-1 block text-base font-medium text-text ${selected.isClosed ? '' : 'num'}`}>
            {selected.hours.split('、').map((part) => (
              <span key={part} className="block">
                {part}
              </span>
            ))}
          </span>
        </p>
      </div>

      <div role="group" aria-label="曜日" className="mt-3 grid grid-cols-7 gap-1 rounded-xl bg-surface-sunken p-1">
        {days.map((day, index) => (
          <button
            key={day.day}
            type="button"
            onClick={() => setSelectedIndex(index)}
            aria-pressed={index === selectedIndex}
            aria-label={`${day.day}曜日${day.isToday ? '（今日）' : ''} ${day.hours}`}
            className={`relative h-11 rounded-lg text-sm transition-colors duration-[var(--dm-duration-fast)] ${index === selectedIndex ? 'bg-primary-deepest font-medium text-cream' : day.ranges.length === 0 ? 'text-text-muted/60 hover:text-text' : 'text-text-muted hover:text-text'}`}
          >
            {day.day}
            {/* 今日の印。 */}
            {day.isToday && (
              <span className={`absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${index === selectedIndex ? 'bg-lime' : 'bg-cta-deep'}`} />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
