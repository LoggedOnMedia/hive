// All times are shown in South African time regardless of server location.
const TZ = "Africa/Johannesburg";

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD

/** Feed-style label: "09:12", "Yesterday", "Mon", "12 Sep", "12 Sep 2025". */
export function shortTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const key = dayKey(d);

  if (key === today) return d.toLocaleTimeString("en-ZA", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (key === yesterday) return "Yesterday";
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString("en-ZA", { timeZone: TZ, weekday: "short" });
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("en-ZA", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Full label for detail views: "Mon 28 Sep, 09:12". */
export function fullTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
