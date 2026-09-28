import { Gauge, House, Settings, Store, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

// The single source of truth for navigation. New sections are added here
// deliberately, one at a time, as they're built.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/feed", label: "Feed", icon: House, roles: ["regional_manager", "store_manager"] },
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles: ["regional_manager"] },
  { href: "/stores", label: "Stores", icon: Store, roles: ["regional_manager"] },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, roles: ["regional_manager", "store_manager"] },
];

export function navFor(role: Role) {
  return {
    primary: PRIMARY_NAV.filter((i) => i.roles.includes(role)),
    secondary: SECONDARY_NAV.filter((i) => i.roles.includes(role)),
  };
}
