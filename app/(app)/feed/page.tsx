import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage() {
  const viewer = await getViewer();
  const isRM = viewer.role === "regional_manager";

  return (
    <>
      <PageHeader
        title="Feed"
        description={isRM ? "Everything you've sent, most important first." : "Messages and campaign assets, most important first."}
      />
      <FilterChips
        active="All"
        options={[
          { label: "All", href: "/feed" },
          { label: "Unread", href: "/feed?show=unread" },
          { label: "Urgent", href: "/feed?show=urgent" },
        ]}
      />
      <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface">
        <EmptyState
          icon={<Inbox className="size-6" strokeWidth={1.8} />}
          title={isRM ? "Nothing sent yet" : "You're all caught up"}
          action={
            isRM ? (
              <ButtonLink href="/compose">Send the first message</ButtonLink>
            ) : undefined
          }
        >
          {isRM
            ? "Messages and campaign assets you send will appear here, ordered by priority."
            : "New messages and campaign assets from your regional manager will show up here."}
        </EmptyState>
      </div>
      <p className="mt-6 text-center text-xs text-faint">
        Design preview:{" "}
        <a href="/design" className="underline hover:text-ink">
          see how feed cards will look
        </a>
      </p>
    </>
  );
}
