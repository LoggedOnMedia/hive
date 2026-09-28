import Link from "next/link";
import { Megaphone, MessageCircle } from "lucide-react";
import { PriorityPill } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Priority } from "@/lib/priority";

/**
 * One card in the store manager's feed. Urgent items get the gold-tinted
 * announcement treatment; unseen items get a gold edge marker.
 */
export function PostCard({
  href,
  title,
  preview,
  priority,
  timeLabel,
  unseen = false,
  replies = 0,
  children,
}: {
  href: string;
  title: string;
  preview: string;
  priority: Priority;
  timeLabel: string;
  unseen?: boolean;
  replies?: number;
  children?: React.ReactNode;
}) {
  const highlighted = priority === "urgent";
  return (
    <article
      className={cn(
        "relative rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-card)] md:p-5",
        highlighted ? "border-gold-line bg-gold-tint" : "border-line bg-surface",
      )}
    >
      {unseen && (
        <span className="absolute left-0 top-5 h-8 w-1 rounded-r-full bg-gold" aria-label="Not yet opened" />
      )}
      <Link href={href} className="flex gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
          <Megaphone className="size-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className={cn("line-clamp-2 text-[15px] leading-snug text-ink", unseen ? "font-bold" : "font-semibold")}>{title}</h3>
            <span className="ml-auto shrink-0 pt-0.5 text-xs text-faint">{timeLabel}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{preview}</p>
          <div className="mt-3 flex items-center gap-3">
            <PriorityPill priority={priority} />
            {replies > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <MessageCircle className="size-3.5" /> {replies} {replies === 1 ? "reply" : "replies"}
              </span>
            )}
          </div>
        </div>
      </Link>
      {children && <div className="mt-4 flex flex-col gap-2 md:pl-14">{children}</div>}
    </article>
  );
}
