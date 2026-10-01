"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While something is sending (or due any moment), re-fetches the page every
 * few seconds so per-channel statuses update without leaving the tab. Stops by
 * itself once nothing is in flight, or after 15 minutes as a safety net.
 */
export function AutoRefresh({ active, everyMs = 3000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - started > 15 * 60_000) return clearInterval(id);
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [active, everyMs, router]);
  return null;
}
