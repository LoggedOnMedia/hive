"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiveLogo, Hexagon } from "@/components/brand/logo";
import { CountBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { navFor, type NavItem } from "@/lib/nav";
import type { Role } from "@/lib/roles";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function SidebarLink({ item, active, count = 0 }: { item: NavItem; active: boolean; count?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors",
        active ? "bg-gold text-ink" : "text-chrome-text hover:bg-chrome-raised hover:text-white",
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.8} />
      <span className="flex-1">{item.label}</span>
      <CountBadge count={count} className={active ? "bg-ink text-gold" : undefined} />
    </Link>
  );
}

export function Sidebar({
  role,
  counts = {},
  footer,
}: {
  role: Role;
  counts?: Record<string, number>;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { primary, secondary } = navFor(role);

  return (
    <aside className="relative hidden w-64 shrink-0 flex-col overflow-hidden bg-chrome md:flex">
      <div className="px-6 pb-8 pt-7">
        <Link href="/feed" aria-label="Hive home">
          <HiveLogo tone="light" className="h-10 w-auto" />
        </Link>
      </div>

      <nav className="flex flex-col gap-1 px-3" aria-label="Main">
        {primary.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} count={counts[item.href]} />
        ))}
      </nav>

      {/* Decorative honeycomb — branding flourish only */}
      <div className="pointer-events-none relative mt-auto h-44" aria-hidden="true">
        <Hexagon className="absolute left-6 top-2 h-24 text-gold/15" />
        <Hexagon className="absolute left-[76px] top-[58px] h-24 text-gold/25" />
        <Hexagon className="absolute left-[128px] top-3 h-12 text-gold/10" />
      </div>

      <nav className="flex flex-col gap-1 px-3 pb-3" aria-label="Secondary">
        {secondary.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      {footer && <div className="px-3 pb-4">{footer}</div>}
    </aside>
  );
}
