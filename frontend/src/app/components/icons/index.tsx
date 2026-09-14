/**
 * アイコン。すべて SVG（絵文字をアイコン代わりに使わない / docs/design.md 1節）。
 *
 * 装飾なので既定で aria-hidden。意味を持たせたい場合は親のボタンに aria-label を付ける。
 */

type IconProps = { className?: string };

export function ClockIcon({ className = 'w-[17px] h-[17px]' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function PhoneIcon({ className = 'w-[17px] h-[17px]' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5.5C4 4.67 4.67 4 5.5 4h2.2c.65 0 1.22.42 1.42 1.04l.86 2.6a1.5 1.5 0 01-.4 1.55l-1.2 1.1a12.5 12.5 0 005.33 5.33l1.1-1.2a1.5 1.5 0 011.55-.4l2.6.86c.62.2 1.04.77 1.04 1.42v2.2c0 .83-.67 1.5-1.5 1.5A15.5 15.5 0 014 5.5z" />
    </svg>
  );
}

export function MapIcon({ className = 'w-[22px] h-[22px]' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v13M15 6.5v13" />
    </svg>
  );
}

export function SortIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20V4m0 16l-3-3m3 3l3-3M17 4v16m0-16l-3 3m3-3l3 3" />
    </svg>
  );
}

export function LoadingSpinner({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export function LocationIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function TargetIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="7" strokeWidth={2} />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function CupIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h12v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 9h2.5a2.5 2.5 0 010 5H16" />
      <path strokeLinecap="round" strokeWidth={2} d="M8 2.5v2M12 2.5v2" />
    </svg>
  );
}

export function StarIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function LinkIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

export function BookmarkIcon({ filled, className = 'w-[22px] h-[22px]' }: IconProps & { filled: boolean }) {
  return (
    <svg className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4.5A1.5 1.5 0 016.5 3h11A1.5 1.5 0 0119 4.5V21l-7-4-7 4V4.5z" />
    </svg>
  );
}

export function ShareIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

export function CloseIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronRightIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ArrowRightIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function AlertIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={`${className} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 7.5v5M12 16h.01" />
    </svg>
  );
}

export function CheckIcon({ className = 'w-2.5 h-2.5' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function SearchIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="11" cy="11" r="7" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M16.5 16.5L21 21" />
    </svg>
  );
}
