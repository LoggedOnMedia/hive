import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** The persistent glanceable stat card anchored at the bottom of the sidebar. */
export function SidebarCard({
  href,
  label,
  value,
  caption,
}: {
  href: string;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl bg-chrome-raised p-4 hover:bg-chrome-line">
      <div className="flex-1">
        <p className="text-xs font-medium text-chrome-muted">{label}</p>
        <p className="mt-1 text-lg font-bold leading-none text-white tabular-nums">{value}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-chrome-text">
          <span className="size-1.5 rounded-full bg-gold" />
          {caption}
        </p>
      </div>
      <ChevronRight className="size-4 text-chrome-muted group-hover:text-white" />
    </Link>
  );
}
