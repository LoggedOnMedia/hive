import { cn } from "@/lib/cn";
import { PRIORITY_META, type Priority } from "@/lib/priority";

/** Gold unread-count circle. Renders nothing for 0. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-ink tabular-nums",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const priorityStyles: Record<Priority, string> = {
  urgent: "bg-urgent text-white",
  high: "bg-high-tint text-high",
  normal: "bg-subtle text-muted",
  low: "border border-line text-faint",
};

export function PriorityPill({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wide",
        priorityStyles[priority],
        className,
      )}
    >
      {PRIORITY_META[priority].label}
    </span>
  );
}
