"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/cn";

const DISMISS_KEY = "hive-samsung-note-dismissed";

/**
 * Samsung Internet packages installed web apps for an old Android version, so
 * on Android 14+ Google Play Protect blocks the install ("Unsafe app blocked")
 * and nothing appears on the home screen. Chrome's install works. This points
 * Samsung Internet users to Chrome. Notifications work in both browsers.
 */
export function SamsungInstallNote({ variant = "banner" }: { variant?: "banner" | "inline" }) {
  const [show, setShow] = useState(false);
  const [chromeUrl, setChromeUrl] = useState("");

  useEffect(() => {
    const samsung = /SamsungBrowser/i.test(navigator.userAgent);
    const installed = window.matchMedia("(display-mode: standalone)").matches;
    let dismissed = false;
    try {
      dismissed = variant === "banner" && localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    const { host, pathname, search } = window.location;
    // Android intent link: opens this exact page in Chrome.
    // Reads navigator/localStorage, which only exist on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChromeUrl(`intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`);
    setShow(samsung && !installed && !dismissed);
  }, [variant]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-[var(--radius-card)] border p-4",
        variant === "banner" ? "mb-4 border-gold-line bg-gold-tint pr-10" : "mt-4 border-line bg-canvas",
      )}
    >
      <div>
        <p className="text-sm font-semibold text-ink">Installing Hive on this phone? Use Chrome.</p>
        <p className="mt-1 text-sm text-muted">
          Samsung Internet&apos;s app install is currently blocked by Google Play Protect on newer Android phones, so the icon
          never appears. Open Hive in Chrome, then tap <strong>⋮ → Add to home screen</strong>. Notifications work in either browser.
        </p>
      </div>
      <a
        href={chromeUrl}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-ink hover:bg-gold-strong"
      >
        <ExternalLink className="size-4" strokeWidth={2} /> Open in Chrome
      </a>
      {variant === "banner" && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-gold-line/50"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
