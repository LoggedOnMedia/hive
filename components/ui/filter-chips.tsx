import Link from "next/link";
import { cn } from "@/lib/cn";

export function FilterChips({ options, active }: { options: { label: string; href: string }[]; active: string }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <Link
          key={o.label}
          href={o.href}
          className={cn(
            "h-9 rounded-full px-4 text-sm font-medium leading-9 transition-colors",
            o.label === active ? "bg-gold text-ink" : "bg-surface text-muted border border-line hover:text-ink",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
