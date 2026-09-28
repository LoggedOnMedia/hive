"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Share, SquarePlus, X } from "lucide-react";
import { removeSubscription, saveSubscription, sendTestPush } from "@/app/actions/push";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type State =
  | "loading"
  | "unsupported" // no service worker / push in this browser
  | "ios-install" // iPhone/iPad in Safari: must be added to the Home Screen first
  | "blocked" // permission denied in browser settings
  | "off"
  | "on";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/** Shared state machine for the settings card and the feed prompt. */
function usePush() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [pending, start] = useTransition();

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }
    if (isIOS() && !isStandalone()) return setState("ios-install");
    if (Notification.permission === "denied") return setState("blocked");
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    // A browser has one subscription however many people use it. Re-link it to
    // whoever is signed in now, so a shared device notifies the right person.
    if (sub) await saveSubscription(sub.toJSON(), navigator.userAgent);
    setState(sub ? "on" : "off");
  }, []);

  useEffect(() => {
    // Checks browser APIs that only exist on the client, so it has to run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const enable = () =>
    start(async () => {
      setError("");
      if (!VAPID) return setError("Notifications aren't set up on the server yet.");
      // Edge and Chrome sometimes ask quietly (a crossed-out bell in the address bar)
      // instead of a popup, and the request waits until it's answered.
      const slow = setTimeout(
        () =>
          setHint(
            "Your browser is asking for permission. Look for a bell icon at the right of the address bar (or the padlock on the left) and choose Allow.",
          ),
        4000,
      );
      const permission = await Notification.requestPermission().finally(() => {
        clearTimeout(slow);
        setHint("");
      });
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      try {
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID) }));
        const result = await saveSubscription(sub.toJSON(), navigator.userAgent);
        if (result.error) return setError(result.error);
        setState("on");
      } catch (e) {
        setError((e as Error).message || "Couldn't turn on notifications.");
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });

  return { state, error, hint, pending, enable, disable, setError };
}

function IOSSteps() {
  return (
    <ol className="flex flex-col gap-2 text-sm text-ink">
      <li className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold">1</span>
        Tap <Share className="size-4 shrink-0" aria-label="Share" /> <strong>Share</strong> at the bottom of Safari
      </li>
      <li className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold">2</span>
        Choose <SquarePlus className="size-4 shrink-0" aria-hidden /> <strong>Add to Home Screen</strong>
      </li>
      <li className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold">3</span>
        Open Hive from your Home Screen and turn notifications on there
      </li>
    </ol>
  );
}

/** Settings card: status, turn on/off, send a test. */
export function NotificationSettings() {
  const { state, error, hint, pending, enable, disable, setError } = usePush();
  const [tested, setTested] = useState("");
  const [testing, startTest] = useTransition();

  const test = () =>
    startTest(async () => {
      setError("");
      const r = await sendTestPush();
      if (r.error) setError(r.error);
      else setTested("Sent — it should appear in a moment.");
    });

  return (
    <div className="flex flex-col gap-4">
      {state === "loading" && <p className="text-sm text-muted">Checking this device…</p>}
      {state === "unsupported" && (
        <p className="text-sm text-muted">This browser can&apos;t receive notifications. Try Chrome on Android, or Safari on iPhone (iOS 16.4 or newer).</p>
      )}
      {state === "ios-install" && (
        <>
          <p className="text-sm text-muted">On iPhone, Hive has to be on your Home Screen before it can send notifications:</p>
          <IOSSteps />
        </>
      )}
      {state === "blocked" && (
        <p className="text-sm text-muted">
          Notifications are blocked for Hive on this device. Allow them in your browser or phone settings for this site, then come back here.
        </p>
      )}
      {(state === "off" || state === "on") && (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
              state === "on" ? "bg-ok/10 text-ok" : "bg-subtle text-muted",
            )}
          >
            {state === "on" ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
            {state === "on" ? "On for this device" : "Off on this device"}
          </span>
          {state === "off" ? (
            <Button type="button" onClick={enable} disabled={pending}>
              {pending ? "Turning on…" : "Turn on notifications"}
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={test} disabled={testing}>
                {testing ? "Sending…" : "Send a test"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={disable} disabled={pending}>
                Turn off
              </Button>
            </>
          )}
        </div>
      )}
      {hint && <p className="rounded-xl bg-gold-tint px-3 py-2 text-sm text-ink">{hint}</p>}
      {tested && !error && <p className="text-sm text-ok">{tested}</p>}
      {error && <p className="text-sm text-urgent">{error}</p>}
    </div>
  );
}

const DISMISS_KEY = "hive-push-prompt-dismissed";

/** Feed banner nudging store managers to turn notifications on. Hidden once on, or dismissed. */
export function NotificationPrompt() {
  const { state, error, hint, pending, enable } = usePush();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let value = false;
    try {
      value = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    // Reads localStorage, which only exists on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(value);
  }, []);

  if (dismissed || !(state === "off" || state === "ios-install")) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="relative mb-4 flex flex-col gap-3 rounded-[var(--radius-card)] border border-gold-line bg-gold-tint p-4 pr-10 md:flex-row md:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
        <BellRing className="size-5" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">Get notified about new messages</p>
        {state === "ios-install" ? (
          <div className="mt-2">
            <IOSSteps />
          </div>
        ) : (
          <p className="text-sm text-muted">So urgent messages reach you even when Hive is closed.</p>
        )}
        {hint && <p className="mt-1 text-sm font-medium text-ink">{hint}</p>}
        {error && <p className="mt-1 text-sm text-urgent">{error}</p>}
      </div>
      {state === "off" && (
        <Button type="button" onClick={enable} disabled={pending} className="shrink-0">
          {pending ? "Turning on…" : "Turn on"}
        </Button>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-gold-line/50">
        <X className="size-4" />
      </button>
    </div>
  );
}
