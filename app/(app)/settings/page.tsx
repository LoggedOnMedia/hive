import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { NotificationSettings } from "@/components/push/notifications";
import { ROLE_LABEL } from "@/components/shell/top-bar";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader title="Settings" />
      <section className="max-w-xl rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <div className="flex items-center gap-4">
          <Avatar name={viewer.name} size="lg" tone={viewer.role === "regional_manager" ? "gold" : "neutral"} />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{viewer.name}</p>
            <p className="truncate text-sm text-muted">{viewer.email}</p>
            <p className="text-sm text-muted">
              {ROLE_LABEL[viewer.role]}
              {viewer.storeName && ` · ${viewer.storeName}`}
            </p>
          </div>
        </div>
        <form action={signOut} className="mt-5 border-t border-line pt-5">
          <Button variant="secondary" className="w-full sm:w-auto">
            <LogOut className="size-4" strokeWidth={1.8} />
            Sign out
          </Button>
        </form>
      </section>
      <div className="mt-4 max-w-xl">
        <Panel title="Notifications" description="Get a notification on this device when a message or reply comes in. Turn it on for each phone or computer you use.">
          <NotificationSettings />
        </Panel>
      </div>
    </>
  );
}
