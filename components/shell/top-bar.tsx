import { Bell, LogOut, Plus } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { Viewer } from "@/lib/viewer";

export const ROLE_LABEL = { regional_manager: "Regional Manager", store_manager: "Store Manager" } as const;

export function TopBar({ viewer }: { viewer: Viewer }) {
  return (
    <header className="sticky top-0 z-20 hidden h-[72px] items-center gap-4 border-b border-line bg-surface/90 px-8 backdrop-blur md:flex">
      <div className="ml-auto flex items-center gap-3">
        {viewer.role === "regional_manager" && (
          <ButtonLink href="/compose">
            <Plus className="size-4" strokeWidth={2.4} />
            New message
          </ButtonLink>
        )}
        <button
          className="relative flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle"
          aria-label="Notifications"
        >
          <Bell className="size-5" strokeWidth={1.8} />
        </button>
        <div className="flex items-center gap-3 border-l border-line pl-4">
          <Avatar name={viewer.name} tone={viewer.role === "regional_manager" ? "gold" : "neutral"} />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink">{viewer.name}</p>
            <p className="text-xs text-muted">{viewer.storeName ?? ROLE_LABEL[viewer.role]}</p>
          </div>
          <form action={signOut}>
            <button
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" strokeWidth={1.8} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
