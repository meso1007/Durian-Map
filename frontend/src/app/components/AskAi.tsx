'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { AI_TARGETS, buildAiPrompt } from '@/lib/aiPrompt';
import type { AiPromptContext } from '@/lib/aiPrompt';
import type { MapInsets } from '@/lib/layout';
import { copyText } from '@/lib/share';

import { ChevronRightIcon } from './icons';

/**
 * 「AI に相談」。地図の左下に浮くボタン。
 *
 * 押すと、いまの画面の内容（検索条件・候補の一覧・開いている店）を入れたプロンプトで
 * 外部の AI チャットを開く。会話は相手側のサービスで続ける — このアプリは会話を持たない。
 * 置く場所は UI に覆われていない領域の左下で、Google のロゴの上（ロゴを隠さない / docs/design.md 4.5節）。
 */
export default function AskAi({
  context,
  insets,
  onNotify,
}: {
  context: AiPromptContext;
  insets: MapInsets;
  onNotify: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // メニューの外を押したら閉じる。Esc でも閉じる（詳細を閉じる Esc より先に受ける）。
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  // プロンプトは開いたときの画面の内容で作る（押すたびに最新になる）。
  const prompt = open ? buildAiPrompt(context) : '';

  const handleCopy = async () => {
    setOpen(false);
    onNotify((await copyText(prompt)) ? 'プロンプトをコピーしました' : 'コピーできませんでした');
  };

  return (
    <div
      ref={rootRef}
      className="absolute z-10"
      style={{ left: insets.left + 12, bottom: `calc(${insets.bottom}px + 2.75rem)` }}
    >
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="AI に相談"
          className="absolute bottom-[calc(100%+0.5rem)] left-0 w-60 animate-pop rounded-xl bg-surface p-1.5 shadow-float"
        >
          <p className="px-3 pb-1.5 pt-2 text-xs leading-[1.5] text-text-muted">
            いまの画面の内容を入れたプロンプトで開きます
          </p>

          {AI_TARGETS.map(({ id, label, href }) => (
            <a
              key={id}
              role="menuitem"
              href={href(prompt)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-between rounded-lg px-3 text-sm text-text hover:bg-surface-sunken"
            >
              {label}
              <ChevronRightIcon className="h-4 w-4 text-text-muted" />
            </a>
          ))}

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleCopy()}
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-text hover:bg-surface-sunken"
          >
            プロンプトをコピー
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 text-sm font-medium text-text shadow-float transition-transform duration-[var(--dm-duration-fast)] active:scale-95"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 12a7.5 7.5 0 01-11.2 6.52L4 20l1.5-4.4A7.5 7.5 0 1120 12z"
          />
          <path strokeLinecap="round" strokeWidth={1.5} d="M9 11h6M9 14h3.5" />
        </svg>
        AI に相談
      </button>
    </div>
  );
}
