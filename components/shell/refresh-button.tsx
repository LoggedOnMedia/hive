"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Re-fetches the current page's data without a full reload. An installed app
 * has no browser reload button, so this is the only way to check for new messages.
 */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      aria-label="Refresh"
      title="Refresh"
      className={cn("relative flex items-center justify-center rounded-xl disabled:cursor-wait", className)}
    >
      <RefreshCw className={cn("size-5", pending && "animate-spin")} strokeWidth={1.8} />
    </button>
  );
}
