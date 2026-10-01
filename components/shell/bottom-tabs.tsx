"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { navFor } from "@/lib/nav";
import type { Role } from "@/lib/roles";
import { isActive } from "./sidebar";

export function BottomTabs({
  role,
  counts = {},
  features = [],
}: {
  role: Role;
  counts?: Record<string, number>;
  features?: string[];
}) {
  const pathname = usePathname();
  const { primary, secondary } = navFor(role, features);
  const tabs = [...primary, ...secondary];
  const canCompose = role === "regional_manager";

  const items = tabs.map((item) => {
    const Icon = item.icon;
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium"
      >
        <span
          className={cn(
            "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
            active ? "bg-gold text-ink" : "text-muted",
          )}
        >
          <Icon className="size-5" strokeWidth={1.8} />
          {(counts[item.href] ?? 0) > 0 && (
            <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink ring-2 ring-surface">
              {counts[item.href]}
            </span>
          )}
        </span>
        <span className={active ? "text-ink" : "text-muted"}>{item.label}</span>
      </Link>
    );
  });

  // Regional manager gets a raised "New" action in the middle of the bar.
  if (canCompose) {
    items.splice(
      Math.ceil(items.length / 2),
      0,
      <Link
        key="compose"
        href="/compose"
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-ink"
      >
        <span className="-mt-5 flex size-12 items-center justify-center rounded-full bg-gold shadow-lg shadow-gold/40 ring-4 ring-surface">
          <Plus className="size-6" strokeWidth={2.2} />
        </span>
        <span>New</span>
      </Link>,
    );
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items}
    </nav>
  );
}
