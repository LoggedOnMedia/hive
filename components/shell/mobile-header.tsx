import Link from "next/link";
import { Bell } from "lucide-react";
import { HiveLogo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { RefreshButton } from "./refresh-button";
import type { Viewer } from "@/lib/viewer";

export function MobileHeader({ viewer }: { viewer: Viewer }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 bg-chrome px-4 pt-[env(safe-area-inset-top)] md:hidden">
      <Link href="/feed" aria-label="Hive home">
        <HiveLogo tone="light" className="h-8 w-auto" />
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <RefreshButton className="size-10 text-white" />
        <Link
          href="/settings"
          className="relative flex size-10 items-center justify-center rounded-xl text-white"
          aria-label="Notification settings"
        >
          <Bell className="size-5" strokeWidth={1.8} />
        </Link>
        <Avatar name={viewer.name} size="sm" tone={viewer.role === "regional_manager" ? "gold" : "chrome"} />
      </div>
    </header>
  );
}
