"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { setArchived } from "@/app/actions/posts";
import { cn } from "@/lib/cn";

/** Archive / unarchive a post in the viewer's own feed. */
export function ArchiveButton({
  postId,
  archived,
  variant = "button",
}: {
  postId: string;
  archived: boolean;
  variant?: "button" | "icon";
}) {
  const [pending, startTransition] = useTransition();
  const Icon = archived ? ArchiveRestore : Archive;
  const label = archived ? "Unarchive" : "Archive";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setArchived(postId, !archived))}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-semibold transition-colors disabled:opacity-50",
        variant === "icon"
          ? "size-9 rounded-full text-faint hover:bg-subtle hover:text-ink"
          : "h-9 rounded-xl border border-line bg-surface px-3 text-sm text-ink hover:bg-subtle",
      )}
    >
      <Icon className="size-4" strokeWidth={1.8} />
      {variant === "button" && label}
    </button>
  );
}
