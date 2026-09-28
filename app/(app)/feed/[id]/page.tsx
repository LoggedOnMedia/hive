import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, Lock, Pencil, Users } from "lucide-react";
import { PriorityPill } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { ArchiveButton } from "@/components/feed/archive-button";
import { ReactionBar } from "@/components/feed/emoji";
import { getPost, getReactions, getThread } from "@/lib/posts";
import { fullTime, shortTime } from "@/lib/time";
import { getViewer } from "@/lib/viewer";
import { DeletePostButton, MarkSeen, ReplyForm, Thread } from "./client";

export async function generateMetadata({ params }: PageProps<"/feed/[id]">): Promise<Metadata> {
  const post = await getPost((await params).id, await getViewer());
  return { title: post?.title ?? "Message" };
}

export default async function PostPage({ params, searchParams }: PageProps<"/feed/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  const post = await getPost(id, viewer);
  if (!post) notFound();
  const thread = await getThread(id);
  const isRM = viewer.role === "regional_manager";

  // Private replies: the regional manager reads one store's conversation at a time.
  const privateRM = isRM && !post.repliesShared;
  const requested = (await searchParams).store;
  const activeStore = privateRM
    ? (post.recipients.find((r) => r.storeId === requested) ??
      post.recipients.find((r) => thread.some((m) => m.storeId === r.storeId)) ??
      post.recipients[0])
    : undefined;
  const visible = activeStore ? thread.filter((m) => m.storeId === activeStore.storeId) : thread;
  const reactions = await getReactions(post.id, thread.map((m) => m.id), viewer);
  const seenCount = post.recipients.filter((r) => r.seenAt).length;

  return (
    <div className="max-w-5xl">
      {!isRM && !post.seenByMe && <MarkSeen postId={post.id} />}
      <Link href="/feed" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Feed
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <article
            className={cn(
              "rounded-[var(--radius-card)] border p-5 md:p-6",
              post.priority === "urgent" ? "border-gold-line bg-gold-tint" : "border-line bg-surface",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <PriorityPill priority={post.priority} />
              {post.editedAt && <span className="text-xs text-faint">Edited {shortTime(post.editedAt)}</span>}
              {post.archivedByMe && (
                <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Archived
                </span>
              )}
            </div>
            <h1 className="mt-3 text-xl font-bold leading-snug tracking-tight text-ink md:text-2xl">{post.title}</h1>
            <p className="mt-2 text-xs text-muted">
              {post.authorName} · Regional Manager · {fullTime(post.createdAt)}
            </p>
            {post.body && <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{post.body}</p>}
            <div className="mt-4">
              <ReactionBar postId={post.id} target="post" reactions={reactions.post ?? []} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line/70 pt-4">
              {isRM && (
                <>
                  <ButtonLink href={`/feed/${post.id}/edit`} variant="secondary" size="sm">
                    <Pencil className="size-4" strokeWidth={1.8} /> Edit
                  </ButtonLink>
                  <DeletePostButton postId={post.id} />
                </>
              )}
              <ArchiveButton postId={post.id} archived={post.archivedByMe} />
            </div>
          </article>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Replies</h2>
              <span className="flex items-center gap-1 text-xs text-muted">
                {post.repliesShared ? (
                  <>
                    <Users className="size-3.5" /> Visible to all stores on this message
                  </>
                ) : (
                  <>
                    <Lock className="size-3.5" /> {isRM ? "Private — one conversation per store" : "Only you and your regional manager see these"}
                  </>
                )}
              </span>
            </div>

            {privateRM && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {post.recipients.map((r) => {
                  const count = thread.filter((m) => m.storeId === r.storeId).length;
                  const active = r.storeId === activeStore?.storeId;
                  return (
                    <Link
                      key={r.storeId}
                      href={`/feed/${post.id}?store=${r.storeId}`}
                      scroll={false}
                      className={cn(
                        "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                        active ? "bg-gold text-ink" : "border border-line bg-surface text-muted hover:text-ink",
                      )}
                    >
                      {r.storeName}
                      {count > 0 && <span className={cn("text-xs", active ? "text-ink/70" : "text-faint")}>{count}</span>}
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="mb-4">
              <Thread
                postId={post.id}
                messages={visible}
                reactions={reactions}
                storeId={activeStore?.storeId}
                emptyLabel={`No replies yet${activeStore ? ` from ${activeStore.storeName}` : ""}.`}
              />
            </div>

            <ReplyForm
              key={activeStore?.storeId ?? "all"}
              postId={post.id}
              storeId={activeStore?.storeId}
              placeholder={
                activeStore
                  ? `Reply to ${activeStore.storeName}…`
                  : isRM
                    ? "Reply to all stores…"
                    : "Write a reply…"
              }
            />
          </section>
        </div>

        {isRM && (
          <aside>
            <Panel title={`Seen by ${seenCount} of ${post.recipients.length}`}>
              <ul className="-mx-1 flex flex-col">
                {post.recipients.map((r) => (
                  <li key={r.storeId} className="flex items-center gap-3 rounded-lg px-1 py-2">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        r.seenAt ? "bg-ok/15 text-ok" : "bg-subtle text-faint",
                      )}
                    >
                      {r.seenAt ? <Check className="size-3.5" strokeWidth={2.6} /> : <span className="size-1.5 rounded-full bg-faint" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.storeName}</span>
                    <span className="shrink-0 text-xs text-muted">{r.seenAt ? shortTime(r.seenAt) : "Not opened"}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        )}
      </div>
    </div>
  );
}
