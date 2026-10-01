import { Gauge, House, Radio, Settings, Store, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Only shown when this optional feature is switched on (see AppLayout). */
  feature?: string;
};

// The single source of truth for navigation. New sections are added here
// deliberately, one at a time, as they're built.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/feed", label: "Feed", icon: House, roles: ["regional_manager", "store_manager"] },
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles: ["regional_manager"] },
  { href: "/stores", label: "Stores", icon: Store, roles: ["regional_manager"] },
  // wa-channels module (removable — see modules/wa-channels/README.md)
  { href: "/whatsapp", label: "WhatsApp", icon: Radio, roles: ["regional_manager", "store_manager"], feature: "wa" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, roles: ["regional_manager", "store_manager"] },
];

export function navFor(role: Role, features: string[] = []) {
  const show = (i: NavItem) => i.roles.includes(role) && (!i.feature || features.includes(i.feature));
  return { primary: PRIMARY_NAV.filter(show), secondary: SECONDARY_NAV.filter(show) };
}
