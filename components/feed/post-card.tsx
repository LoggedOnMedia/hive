import Link from "next/link";
import { Megaphone, MessageCircle } from "lucide-react";
import { PriorityPill } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Priority } from "@/lib/priority";

/**
 * One card in the feed. Urgent items get the gold-tinted announcement
 * treatment; unseen items get a gold edge marker and a bold title.
 */
export function PostCard({
  href,
  title,
  preview,
  priority,
  timeLabel,
  unseen = false,
  edited = false,
  replies = 0,
  meta,
  action,
  children,
}: {
  href: string;
  title: string;
  preview: string;
  priority: Priority;
  timeLabel: string;
  unseen?: boolean;
  edited?: boolean;
  replies?: number;
  /** Extra line items after the priority pill (e.g. "Seen by 4 of 6"). */
  meta?: React.ReactNode;
  /** Control shown in the card's bottom-right corner, outside the link (e.g. archive). */
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const highlighted = priority === "urgent";
  return (
    <article
      className={cn(
        "relative rounded-[var(--radius-card)] border shadow-[var(--shadow-card)] transition-colors",
        highlighted ? "border-gold-line bg-gold-tint" : "border-line bg-surface hover:border-gold-line",
      )}
    >
      {unseen && (
        <span className="absolute left-0 top-5 h-8 w-1 rounded-r-full bg-gold" aria-label="Not yet opened" />
      )}
      <Link href={href} className={cn("flex gap-3 p-4 md:p-5", Boolean(action) && "pr-14 md:pr-16")}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
          <Megaphone className="size-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className={cn("line-clamp-2 text-[15px] leading-snug text-ink", unseen ? "font-bold" : "font-semibold")}>
              {title}
            </h3>
            <span className="ml-auto shrink-0 pt-0.5 text-xs text-faint">{timeLabel}</span>
          </div>
          {preview && <p className="mt-1 line-clamp-2 text-sm text-muted">{preview}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <PriorityPill priority={priority} />
            {replies > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <MessageCircle className="size-3.5" /> {replies} {replies === 1 ? "reply" : "replies"}
              </span>
            )}
            {meta}
            {edited && <span className="text-xs text-faint">Edited</span>}
          </div>
        </div>
      </Link>
      {Boolean(action) && <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4">{action}</div>}
      {children && <div className="flex flex-col gap-2 px-4 pb-4 md:px-5 md:pb-5 md:pl-[76px]">{children}</div>}
    </article>
  );
}
