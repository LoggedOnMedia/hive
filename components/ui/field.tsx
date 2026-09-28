import { cn } from "@/lib/cn";

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-faint focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
