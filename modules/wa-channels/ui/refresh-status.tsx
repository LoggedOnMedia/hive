"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

/** Big "Refresh status" button for the Posts tab, with the time it last updated. */
export function RefreshStatus() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [updated, setUpdated] = useState<string | null>(null);

  const refresh = () =>
    start(() => {
      router.refresh();
      setUpdated(
        new Date().toLocaleTimeString("en-ZA", {
          timeZone: "Africa/Johannesburg",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="inline-flex h-12 items-center gap-2.5 rounded-xl border-2 border-gold bg-gold-tint px-5 text-base font-semibold text-ink transition-colors hover:bg-gold disabled:cursor-wait"
      >
        <RefreshCw className={cn("size-5", pending && "animate-spin")} strokeWidth={2} />
        {pending ? "Refreshing…" : "Refresh status"}
      </button>
      {updated && !pending && <span className="text-sm text-muted">Updated {updated}</span>}
    </div>
  );
}
