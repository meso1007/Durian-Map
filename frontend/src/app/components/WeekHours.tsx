'use client';

import { useMemo, useState } from 'react';

import { parseHourRanges } from '@/lib/cafe';
import type { DayHours } from '@/lib/cafe';

/**
 * 軸の既定の範囲（6:00–24:00）。どの店も同じ軸に載せるので、朝の店は柱が上に、夜の店は下に寄り、
 * 柱の位置と長さがその店の形になる。店ごとに軸を合わせると、毎日同じ時間の店は 7 本とも
 * 端から端まで塗られて、何も伝わらない。
 */
const BASE_AXIS = { start: 6 * 60, end: 24 * 60 };

/** いまの時刻（JST、0:00 からの分）。端末のタイムゾーンに関係なく JST で出す。 */
function getJstMinutes(now: Date): number {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

/** 目盛りの表記（時だけ）。24 時を超える分は折り返す（27 時 → 3）。24 時ちょうどは 24 のまま。 */
function formatAxisTime(minutes: number): string {
  const hour = minutes / 60;
  return String(hour > 24 ? hour - 24 : hour);
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

  // 軸は共通。6 時より早く開く店・24 時を過ぎて閉める店のときだけ、その分を広げる（時単位）。
  const axis = useMemo(() => {
    const all = days.flatMap((day) => day.ranges);

    return {
      start: Math.min(BASE_AXIS.start, ...all.map((range) => Math.floor(range.start / 60) * 60)),
      end: Math.max(BASE_AXIS.end, ...all.map((range) => Math.ceil(range.end / 60) * 60)),
    };
  }, [days]);

  // 目盛りは 6 時間おき（6 / 12 / 18 / 24 …）。
  const ticks = useMemo(() => {
    const values: number[] = [];
    for (let minutes = Math.ceil(axis.start / 360) * 360; minutes <= axis.end; minutes += 360) values.push(minutes);

    // 深夜まで広げた軸は、端の時刻も出す（24 の先に何時まで続くのかが分かるように）。
    // 直前の目盛りと近すぎるときは重なるので出さない。
    if (axis.end - values[values.length - 1] >= 120) values.push(axis.end);
    return values;
  }, [axis]);

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
        <h3 className="text-xs font-medium text-text-muted">営業時間</h3>
        {/* 選んだ曜日の時刻。柱を押すたびに読み上げる。 */}
        <p aria-live="polite" className="text-sm font-medium text-text">
          {selected.day}曜
          {selected.isToday && <span className="font-medium text-text-muted">（今日）</span>}
          <span className={`ml-2 ${selected.isClosed ? '' : 'num'}`}>{selected.hours}</span>
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        {/* 軸の目盛り。上が開店側、下が閉店側。 */}
        <div aria-hidden className="num relative h-24 w-6 shrink-0 text-right text-xs leading-none text-text-muted">
          {ticks.map((minutes) => (
            <span key={minutes} className="absolute right-0 -translate-y-1/2" style={{ top: position(minutes) }}>
              {formatAxisTime(minutes)}
            </span>
          ))}
        </div>

        <div className="relative grid min-w-0 flex-1 grid-cols-7 gap-1.5">
          {/* 日付が変わる位置。深夜営業の店で、柱が 24 時の先まで伸びている理由が分かるようにする。 */}
          {axis.end > 1440 && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 z-10 h-px bg-border"
              style={{ top: `calc(6rem * ${(1440 - axis.start) / span})` }}
            />
          )}
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
                  className={`relative block h-24 w-full overflow-hidden rounded-lg transition-colors duration-[var(--dm-duration-fast)] ${day.isToday ? 'bg-success-soft' : 'bg-surface-sunken'} ${isSelected ? 'outline-2 outline-offset-1 outline-primary-deepest' : 'group-hover:outline-1 group-hover:outline-border'}`}
                >
                  {day.ranges.map((range) => (
                    <span
                      key={range.start}
                      className={`absolute inset-x-1.5 rounded-[5px] ${day.isToday ? 'bg-primary-deepest' : 'bg-primary-soft'}`}
                      style={{ top: position(range.start), bottom: `calc(100% - ${position(range.end)})` }}
                    />
                  ))}

                  {day.ranges.length === 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-text-muted">
                      休
                    </span>
                  )}

                  {day.isToday && showNow && (
                    <span className="absolute inset-x-0 h-0.5 -translate-y-1/2 bg-cta" style={{ top: position(nowOnAxis) }} />
                  )}
                </span>

                <span className={`text-xs leading-none ${day.isToday ? 'font-medium text-text' : 'text-text-muted'}`}>
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
