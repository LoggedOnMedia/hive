import { Sidebar } from "@/components/shell/sidebar";
import { SidebarCard } from "@/components/shell/sidebar-card";
import { TopBar } from "@/components/shell/top-bar";
import { MobileHeader } from "@/components/shell/mobile-header";
import { BottomTabs } from "@/components/shell/bottom-tabs";
import { createClient } from "@/lib/supabase/server";
import { countUnread } from "@/lib/posts";
import { getViewer } from "@/lib/viewer";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();

  const counts: Record<string, number> = {};
  let footer: React.ReactNode;
  if (viewer.role === "regional_manager") {
    const supabase = await createClient();
    const { count } = await supabase.from("stores").select("id", { count: "exact", head: true });
    footer = (
      <SidebarCard
        href="/dashboard"
        label="Region overview"
        value={`${count ?? 0} ${count === 1 ? "store" : "stores"}`}
        caption="View dashboard"
      />
    );
  } else {
    counts["/feed"] = await countUnread(viewer);
    footer = <SidebarCard href="/settings" label="Your store" value={viewer.storeName ?? ""} caption={viewer.name} />;
  }

  return (
    <div className="flex h-dvh">
      <Sidebar role={viewer.role} counts={counts} footer={footer} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <MobileHeader viewer={viewer} />
        <TopBar viewer={viewer} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-8">{children}</main>
      </div>
      <BottomTabs role={viewer.role} counts={counts} />
    </div>
  );
}
