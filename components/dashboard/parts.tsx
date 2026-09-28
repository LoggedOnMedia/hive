import { Check, Download, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Cell } from "@/lib/dashboard";

/** KPI tile: one number, a caption, and an optional ratio meter. No plot. */
export function StatTile({
  label,
  value,
  caption,
  ratio,
}: {
  label: string;
  value: string;
  caption?: string;
  /** 0–1; draws a meter under the value. */
  ratio?: number;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-ink md:text-3xl">{value}</p>
      {ratio !== undefined && <Meter ratio={ratio} className="mt-3" />}
      {caption && <p className="mt-2 text-xs text-muted">{caption}</p>}
    </div>
  );
}

/** Single-hue progress track. The number is always printed beside it, so the bar never carries meaning alone. */
export function Meter({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)} aria-hidden="true">
      <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

export const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);

type CellState = "done" | "opened" | "unopened";

function cellState(c: Cell): CellState {
  if (!c.seenAt) return "unopened";
  if (c.filesTotal > 0 && c.filesDone < c.filesTotal) return "opened";
  return "done";
}

const CELL: Record<CellState, { label: (c: Cell) => string; className: string; icon: React.ReactNode }> = {
  done: {
    label: (c) => (c.filesTotal > 0 ? "Opened, all files downloaded" : "Opened"),
    className: "bg-ok/15 text-ok",
    icon: <Check className="size-3.5" strokeWidth={2.8} />,
  },
  opened: {
    label: (c) => `Opened, ${c.filesDone} of ${c.filesTotal} files downloaded`,
    className: "bg-high-tint text-high",
    icon: <Download className="size-3.5" strokeWidth={2.4} />,
  },
  unopened: {
    label: () => "Not opened",
    className: "border border-dashed border-faint text-faint",
    icon: <Minus className="size-3.5" strokeWidth={2.4} />,
  },
};

/** One store × message cell in the grid: icon + colour, with the full state as its tooltip and accessible name. */
export function StatusCell({ cell, storeName }: { cell: Cell | undefined; storeName: string }) {
  if (!cell) return <span className="text-faint" aria-label={`Not sent to ${storeName}`}>·</span>;
  const s = CELL[cellState(cell)];
  const text = `${storeName}: ${s.label(cell)}${cell.replied ? ", replied" : ""}`;
  return (
    <span
      title={text}
      aria-label={text}
      className={cn("relative inline-flex size-7 items-center justify-center rounded-full", s.className)}
    >
      {s.icon}
      {cell.replied && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-gold ring-2 ring-surface" />}
    </span>
  );
}

/** Legend for the grid — identity never rests on colour alone. */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
      <li className="flex items-center gap-1.5">
        <span className={cn("inline-flex size-5 items-center justify-center rounded-full", CELL.done.className)}>{CELL.done.icon}</span>
        Opened (and all files downloaded)
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn("inline-flex size-5 items-center justify-center rounded-full", CELL.opened.className)}>{CELL.opened.icon}</span>
        Opened, files still to download
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn("inline-flex size-5 items-center justify-center rounded-full", CELL.unopened.className)}>{CELL.unopened.icon}</span>
        Not opened
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-gold" /> Replied
      </li>
    </ul>
  );
}
