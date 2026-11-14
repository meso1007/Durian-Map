'use client';

import { useMemo, useState } from 'react';

import { parseHourRanges } from '@/lib/cafe';
import type { DayHours } from '@/lib/cafe';

/** 営業時間が 1 つも読み取れなかったときの軸（8:00–20:00）。 */
const DEFAULT_AXIS = { start: 8 * 60, end: 20 * 60 };

/** いまの時刻（JST、0:00 からの分）。端末のタイムゾーンに関係なく JST で出す。 */
function getJstMinutes(now: Date): number {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

function formatAxisTime(minutes: number): string {
  // 24 時を超える分（深夜営業）は「翌」を付けずに 24 時間表記で折り返す。
  return `${Math.floor((minutes % 1440) / 60)}:00`;
}

/**
 * 1 週間の営業時間。曜日ごとに 1 本の柱を立て、開いている時間帯を塗る。
 *
 * 7 行の表だと「毎日 10:00–19:00」のような店でも同じ行が 7 回並び、詳細の半分を占めてしまう。
 * 柱にすると、定休日・昼休み・深夜営業・週末だけ遅い、といった違いがひと目で分かる。
 * 柱を押すとその曜日の時刻を文字で出す（初期表示は今日）。
 * → docs/design.md 5節「詳細」
 */
export default function WeekHours({ rows }: { rows: DayHours[] }) {
  const todayIndex = Math.max(0, rows.findIndex((row) => row.isToday));
  const [selectedIndex, setSelectedIndex] = useState(todayIndex);

  const days = useMemo(() => rows.map((row) => ({ ...row, ranges: parseHourRanges(row.hours) })), [rows]);

  // 軸は、その店の 1 週間でいちばん早い開店からいちばん遅い閉店まで（時単位に丸める）。
  const axis = useMemo(() => {
    const all = days.flatMap((day) => day.ranges);
    if (all.length === 0) return DEFAULT_AXIS;

    return {
      start: Math.floor(Math.min(...all.map((range) => range.start)) / 60) * 60,
      end: Math.ceil(Math.max(...all.map((range) => range.end)) / 60) * 60,
    };
  }, [days]);

  const span = Math.max(axis.end - axis.start, 60);
  const position = (minutes: number) => `${((minutes - axis.start) / span) * 100}%`;

  // 「いま」の線。深夜営業の店では、日付が変わったあとの時刻を 24 時以降として軸に載せる。
  const [nowMinutes] = useState(() => getJstMinutes(new Date()));
  const nowOnAxis = nowMinutes < axis.start && nowMinutes + 1440 <= axis.end ? nowMinutes + 1440 : nowMinutes;
  const showNow = nowOnAxis >= axis.start && nowOnAxis <= axis.end;

  const selected = days[selectedIndex];

  return (
    <section className="mt-6" aria-label="営業時間">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold text-text-muted">営業時間</h3>
        {/* 選んだ曜日の時刻。柱を押すたびに読み上げる。 */}
        <p aria-live="polite" className="text-sm font-bold text-text">
          {selected.day}曜
          {selected.isToday && <span className="font-medium text-text-muted">（今日）</span>}
          <span className={`ml-2 ${selected.isClosed ? '' : 'num'}`}>{selected.hours}</span>
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        {/* 軸の目盛り。上が開店側、下が閉店側。 */}
        <div aria-hidden className="num flex h-20 w-8 shrink-0 flex-col justify-between text-right text-[11px] leading-none text-text-muted">
          <span>{formatAxisTime(axis.start)}</span>
          <span>{formatAxisTime(axis.end)}</span>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-7 gap-1.5">
          {days.map((day, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                key={day.day}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-pressed={isSelected}
                aria-label={`${day.day}曜日${day.isToday ? '（今日）' : ''} ${day.hours}`}
                className="group flex flex-col items-center gap-1.5 rounded-lg pb-1"
              >
                <span
                  className={`relative block h-20 w-full overflow-hidden rounded-lg transition-colors duration-[var(--dm-duration-fast)] ${day.isToday ? 'bg-success-soft' : 'bg-surface-sunken'} ${isSelected ? 'outline-2 outline-offset-1 outline-primary-deepest' : 'group-hover:outline-1 group-hover:outline-border'}`}
                >
                  {day.ranges.map((range) => (
                    <span
                      key={range.start}
                      className={`absolute inset-x-1.5 rounded-[5px] ${day.isToday ? 'bg-primary-deepest' : 'bg-primary-soft'}`}
                      style={{ top: position(range.start), bottom: `calc(100% - ${position(range.end)})` }}
                    />
                  ))}

                  {day.ranges.length === 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-text-muted">
                      休
                    </span>
                  )}

                  {day.isToday && showNow && (
                    <span className="absolute inset-x-0 h-0.5 -translate-y-1/2 bg-cta" style={{ top: position(nowOnAxis) }} />
                  )}
                </span>

                <span className={`text-xs leading-none ${day.isToday ? 'font-bold text-text' : 'text-text-muted'}`}>
                  {day.day}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
