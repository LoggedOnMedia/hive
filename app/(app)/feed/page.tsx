import type { Metadata } from "next";
import { Eye, Inbox } from "lucide-react";
import { ArchiveButton } from "@/components/feed/archive-button";
import { PostCard } from "@/components/feed/post-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { listFeed, type FeedFilter } from "@/lib/posts";
import { shortTime } from "@/lib/time";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Feed" };

const FILTERS: FeedFilter[] = ["all", "unread", "urgent", "archived"];

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const viewer = await getViewer();
  const isRM = viewer.role === "regional_manager";
  const show = (await searchParams).show;
  const filter: FeedFilter = FILTERS.includes(show as FeedFilter) ? (show as FeedFilter) : "all";
  const items = await listFeed(viewer, filter);

  const labels: Record<FeedFilter, string> = {
    all: "All",
    unread: isRM ? "Not seen by all" : "Unread",
    urgent: "Urgent",
    archived: "Archived",
  };

  const emptyCopy: Record<FeedFilter, { title: string; body: string }> = isRM
    ? {
        all: { title: "Nothing sent yet", body: "Messages you send will appear here, most important first." },
        unread: { title: "Every store has seen everything", body: "Nothing is waiting to be opened." },
        urgent: { title: "No urgent messages", body: "Urgent messages you send will show here." },
        archived: { title: "Nothing archived", body: "Archive messages you're done with to keep your feed clear. They stay here, and come back if someone replies." },
      }
    : {
        all: { title: "Nothing here yet", body: "Messages from your regional manager will show up here." },
        unread: { title: "You're all caught up", body: "You've opened every message." },
        urgent: { title: "No urgent messages", body: "Nothing urgent right now." },
        archived: { title: "Nothing archived", body: "Once you've read a message you can archive it to keep your feed clear. It comes back if someone replies." },
      };

  return (
    <>
      <PageHeader
        title="Feed"
        description={isRM ? "Everything you've sent, most important first." : "Messages from your regional manager, most important first."}
      />
      <FilterChips
        active={labels[filter]}
        options={FILTERS.map((f) => ({ label: labels[f], href: f === "all" ? "/feed" : `/feed?show=${f}` }))}
      />

      {items.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface">
          <EmptyState
            icon={<Inbox className="size-6" strokeWidth={1.8} />}
            title={emptyCopy[filter].title}
            action={isRM && filter === "all" ? <ButtonLink href="/compose">Send the first message</ButtonLink> : undefined}
          >
            {emptyCopy[filter].body}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 flex max-w-3xl flex-col gap-3">
          {items.map((item) => (
            <PostCard
              key={item.id}
              href={`/feed/${item.id}`}
              title={item.title}
              preview={item.body}
              priority={item.priority}
              timeLabel={shortTime(item.createdAt)}
              unseen={!isRM && !item.seen}
              edited={item.edited}
              replies={item.replies}
              action={
                (isRM || item.seen) && <ArchiveButton postId={item.id} archived={item.archived} variant="icon" />
              }
              meta={
                isRM && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      item.seenCount === item.targetCount ? "text-ok" : "text-muted",
                    )}
                  >
                    <Eye className="size-3.5" /> Seen by {item.seenCount} of {item.targetCount}
                  </span>
                )
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
