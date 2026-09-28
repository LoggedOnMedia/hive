"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { SmilePlus } from "lucide-react";
import { toggleReaction } from "@/app/actions/posts";
import { cn } from "@/lib/cn";
import type { ReactionSummary } from "@/lib/posts";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "✅", "👏", "🎉"];

const EMOJI_GRID = [
  "😀", "😃", "😄", "😁", "😅", "😂", "🙂", "😉",
  "😊", "😍", "🤩", "😎", "🤔", "😮", "😬", "😢",
  "😡", "🙈", "👍", "👎", "👌", "👏", "🙌", "🙏",
  "💪", "🤝", "👀", "✅", "❌", "⚠️", "❗", "❓",
  "❤️", "🔥", "⭐", "🎉", "💯", "📦", "🚚", "🛒",
  "📌", "📣", "📅", "⏰", "💰", "🥖", "🥩", "🥦",
];

/** Small popover anchored to its trigger; closes on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** Smiley button that opens the full emoji grid — used in the reply box. */
export function EmojiPicker({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Insert emoji"
        aria-expanded={open}
        className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
      >
        <SmilePlus className="size-5" strokeWidth={1.8} />
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 z-30 grid w-72 grid-cols-8 gap-0.5 rounded-2xl border border-line bg-surface p-2 shadow-xl">
          {EMOJI_GRID.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onPick(e)}
              className="flex size-8 items-center justify-center rounded-lg text-lg hover:bg-subtle"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function applyToggle(list: ReactionSummary[], emoji: string): ReactionSummary[] {
  const existing = list.find((r) => r.emoji === emoji);
  if (!existing) return [...list, { emoji, count: 1, mine: true, names: ["You"] }];
  if (existing.mine) {
    return existing.count === 1
      ? list.filter((r) => r.emoji !== emoji)
      : list.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r));
  }
  return list.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
}

/** Reaction chips for one post or reply, with an add-reaction button. Toggles optimistically. */
export function ReactionBar({
  postId,
  target,
  reactions,
  children,
}: {
  postId: string;
  target: string;
  reactions: ReactionSummary[];
  children?: React.ReactNode;
}) {
  const [optimistic, toggle] = useOptimistic(reactions, applyToggle);
  const [, startTransition] = useTransition();
  const { open, setOpen, ref } = usePopover();

  const react = (emoji: string) => {
    setOpen(false);
    startTransition(async () => {
      toggle(emoji);
      await toggleReaction(postId, target, emoji);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {optimistic.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => react(r.emoji)}
          title={r.names.join(", ")}
          aria-pressed={r.mine}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full border px-2 text-sm transition-colors",
            r.mine ? "border-gold bg-gold-tint text-ink" : "border-line bg-surface text-muted hover:border-gold-line",
          )}
        >
          <span>{r.emoji}</span>
          <span className="text-xs font-semibold tabular-nums">{r.count}</span>
        </button>
      ))}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Add reaction"
          aria-expanded={open}
          className="flex h-7 items-center rounded-full px-2 text-faint hover:bg-subtle hover:text-ink"
        >
          <SmilePlus className="size-4" strokeWidth={1.8} />
        </button>
        {open && (
          <div className="absolute bottom-9 left-0 z-30 flex gap-0.5 rounded-full border border-line bg-surface p-1 shadow-xl">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => react(e)}
                className="flex size-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-110 hover:bg-subtle"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
