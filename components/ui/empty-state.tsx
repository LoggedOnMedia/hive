import { Hexagon } from "@/components/brand/logo";

/** Honeycomb empty state — the hexagon motif doubles as Hive's signature. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="relative mb-6 h-24 w-28">
        <Hexagon className="absolute left-0 top-8 h-14 text-gold-line" />
        <Hexagon className="absolute right-0 top-8 h-14 text-gold-tint" />
        <span className="absolute left-1/2 top-0 flex h-[72px] w-16 -translate-x-1/2 items-center justify-center">
          <Hexagon className="absolute inset-0 h-full w-full text-gold" />
          <span className="relative text-ink">{icon}</span>
        </span>
      </div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children && <p className="mt-1.5 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
