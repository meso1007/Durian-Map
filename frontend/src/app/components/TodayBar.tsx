import { getWeekHours, parseHourRanges } from '@/lib/cafe';

/** 一覧の帯の軸（6:00–24:00）。詳細の WeekHours と同じ基準。帯は細いので、深夜の分は端で切る。 */
const AXIS = { start: 6 * 60, end: 24 * 60 };
const SPAN = AXIS.end - AXIS.start;

const clamp = (minutes: number) => Math.min(Math.max(minutes, AXIS.start), AXIS.end);
const percent = (minutes: number) => `${((clamp(minutes) - AXIS.start) / SPAN) * 100}%`;

/**
 * 今日の営業時間を 1 本の帯で出す（6 時 → 24 時）。塗ってある所が開いている時間、線が「いま」。
 *
 * 詳細の WeekHours と同じ絵を一覧でも使い、朝の店・夜の店・昼休みのある店が並べて見比べられるようにする。
 * 営業時間が取れない店では null を返す（呼び出し側は住所などに倒す）。
 * 文字の営業状態（営業中 21:00まで）が別にあるので、読み上げからは外す。
 */
export default function TodayBar({ weekdayDescriptions, now }: { weekdayDescriptions?: string[]; now: number }) {
  const date = new Date(now);
  const today = getWeekHours(weekdayDescriptions, date)?.find((row) => row.isToday);
  if (!today) return null;

  const ranges = parseHourRanges(today.hours);

  // いまの時刻（JST）。
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  const nowMinutes = jst.getUTCHours() * 60 + jst.getUTCMinutes();
  const showNow = nowMinutes >= AXIS.start && nowMinutes <= AXIS.end;

  return (
    <span aria-hidden className="relative mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken group-hover:bg-border">
      {ranges.map((range) => (
        <span
          key={range.start}
          className="absolute inset-y-0 rounded-full bg-primary-soft"
          style={{ left: percent(range.start), right: `calc(100% - ${percent(range.end)})` }}
        />
      ))}
      {showNow && <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-cta-deep" style={{ left: percent(nowMinutes) }} />}
    </span>
  );
}
