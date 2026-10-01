import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Meter } from "@/components/dashboard/parts";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { fullTime } from "@/lib/time";
import { SANDBOX } from "./config";
import { getSenderState, listChannels, listGroups, listPosts, listStoresForLinking, type Post } from "./server/data";
import { waViewer } from "./server/viewer";
import { getUsage, sandboxWarning } from "./server/usage";
import { AutoRefresh } from "./ui/auto-refresh";
import { RefreshStatus } from "./ui/refresh-status";
import { ChannelRowControls, GroupEditor, PostActions, ResumeButton, SyncButton } from "./ui/manage";
import { NewPostForm } from "./ui/new-post-form";
import { WhatsAppText } from "./ui/wa-format";

// /whatsapp/[[...slug]] — the whole module UI behind one catch-all route.
//   /whatsapp            posts & history
//   /whatsapp/new        new post
//   /whatsapp/channels   channels (regional manager)
//   /whatsapp/groups     groups (regional manager)

export const metadata: Metadata = { title: "WhatsApp channels" };

type Section = "posts" | "new" | "channels" | "groups";

export default async function WaPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const v = await waViewer();
  const slug = (await params).slug ?? [];
  const section = (slug[0] ?? "posts") as Section;
  if (slug.length > 1 || !["posts", "new", "channels", "groups"].includes(section)) notFound();
  if (!v.isRM && (section === "channels" || section === "groups")) notFound();

  const tabs: { key: Section; label: string; href: string; rm?: boolean }[] = [
    { key: "posts", label: "Posts", href: "/whatsapp" },
    { key: "new", label: "New post", href: "/whatsapp/new" },
    { key: "channels", label: "Channels", href: "/whatsapp/channels", rm: true },
    { key: "groups", label: "Groups", href: "/whatsapp/groups", rm: true },
  ];

  const state = await getSenderState();

  return (
    <>
      <PageHeader
        title="WhatsApp channels"
        description={v.isRM ? "Post to your stores' WhatsApp channels — now or on a schedule." : "Post to your store's WhatsApp channel."}
        actions={section !== "new" && <ButtonLink href="/whatsapp/new">New post</ButtonLink>}
      />

      <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="WhatsApp sections">
        {tabs
          .filter((t) => !t.rm || v.isRM)
          .map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={section === t.key ? "page" : undefined}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-medium leading-9",
                section === t.key ? "bg-gold text-ink" : "border border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          ))}
      </nav>

      {state.paused && (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-[var(--radius-card)] border border-urgent/30 bg-urgent-tint p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-urgent">
            <AlertTriangle className="size-4" /> {state.paused_reason ?? "Sending is paused."}
          </p>
          {v.isRM ? <ResumeButton /> : <p className="text-sm text-ink">Posts will go out once your regional manager reconnects WhatsApp.</p>}
        </div>
      )}

      {section === "posts" && <PostsSection />}
      {section === "new" && <NewSection />}
      {section === "channels" && <ChannelsSection />}
      {section === "groups" && <GroupsSection />}
    </>
  );

  async function NewSection() {
    const [channels, groups] = await Promise.all([listChannels(v), v.isRM ? listGroups() : Promise.resolve([])]);
    const active = channels.filter((c) => c.active);
    const activeIds = new Set(active.map((c) => c.id));
    return (
      <div className="flex flex-col gap-4">
        {v.isRM && <UsageWidget />}
        <NewPostForm
          isRM={v.isRM}
          channels={active.map((c) => ({ id: c.id, name: c.name, store_name: c.store_name }))}
          groups={groups.map((g) => ({ ...g, channel_ids: g.channel_ids.filter((id) => activeIds.has(id)) }))}
        />
      </div>
    );
  }

  async function PostsSection() {
    const posts = await listPosts(v);
    // Keep statuses live while anything is sending or due within the next minute.
    const soon = Date.now() + 60_000;
    const inFlight = posts.some(
      (p) => p.status === "sending" || (p.status === "scheduled" && Date.parse(p.scheduled_at) <= soon),
    );
    return (
      <div className="flex flex-col gap-4">
        <AutoRefresh active={inFlight} />
        <RefreshStatus />
        {v.isRM && <UsageWidget />}
        {posts.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
            Nothing posted yet. <Link href="/whatsapp/new" className="font-medium text-ink underline">Create a post</Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {posts.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  function PostRow({ post }: { post: Post }) {
    const sent = post.targets.filter((t) => t.status === "sent").length;
    const failed = post.targets.filter((t) => t.status === "failed");
    const waiting = post.targets.find((t) => t.status === "pending" && t.error);
    const mine = v.isRM || post.created_by === v.id;
    return (
      <li className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 md:flex-row md:p-5">
        {post.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={post.previewUrl} alt="" className="h-28 w-full rounded-xl object-cover md:h-24 md:w-24" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={post.status} />
            <span className="text-xs text-muted">
              {post.status === "scheduled" ? "Sends " : ""}
              {fullTime(post.scheduled_at)}
              {post.author && ` · ${post.author}`}
            </span>
          </div>
          {post.caption && (
            <p className="mt-2 line-clamp-3 break-words text-sm text-ink">
              <WhatsAppText text={post.caption} />
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Sent to {sent} of {post.targets.length} {post.targets.length === 1 ? "channel" : "channels"}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {post.targets.map((t) => (
              <li
                key={t.id}
                title={t.error ?? (t.sent_at ? `Sent ${fullTime(t.sent_at)}` : t.status)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                  t.status === "sent" && "bg-ok/10 text-ok",
                  t.status === "failed" && "bg-urgent-tint text-urgent",
                  (t.status === "pending" || t.status === "sending") && "bg-subtle text-muted",
                )}
              >
                {t.status === "sent" && <CheckCircle2 className="size-3.5" />}
                {t.status === "failed" && <XCircle className="size-3.5" />}
                {t.status === "sending" && <Loader2 className="size-3.5 animate-spin" />}
                {t.status === "pending" && <Clock className="size-3.5" />}
                {t.channel_name}
              </li>
            ))}
          </ul>
          {failed.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-urgent">
              {failed.map((t) => (
                <li key={t.id}>
                  {t.channel_name}: {t.error ?? "Failed"}
                </li>
              ))}
            </ul>
          )}
          {waiting && <p className="mt-2 text-xs text-high">Waiting: {waiting.error}</p>}
          {mine && (
            <div className="mt-3">
              <PostActions postId={post.id} canRetry={failed.length > 0} canCancel={post.status === "scheduled"} />
            </div>
          )}
        </div>
      </li>
    );
  }

  async function UsageWidget() {
    const u = await getUsage();
    const warning = sandboxWarning(u);
    if (u.plan !== "sandbox") {
      return (
        <p className="text-xs text-muted">
          Whapi Premium · {u.requestsThisMonth} API requests this month · {u.messagesToday} messages today
        </p>
      );
    }
    const tiles = [
      { label: "API requests this month", value: u.requestsThisMonth, max: SANDBOX.requestsPerMonth },
      { label: "Messages today (UTC)", value: u.messagesToday, max: SANDBOX.messagesPerDay },
      { label: "Channels posted to this month", value: u.channelsThisMonth.length, max: SANDBOX.conversationsPerMonth },
    ];
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">Whapi Sandbox usage</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label}>
              <p className="text-xs text-muted">{t.label}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">
                {t.value} <span className="text-sm font-normal text-muted">/ {t.max}</span>
              </p>
              <Meter ratio={t.value / t.max} className="mt-1.5" />
            </div>
          ))}
        </div>
        {warning && <p className="mt-3 text-sm font-medium text-high">{warning}</p>}
      </div>
    );
  }

  async function ChannelsSection() {
    const [channels, stores] = await Promise.all([listChannels(v), listStoresForLinking()]);
    return (
      <Panel
        title="Channels"
        description="Channels the WhatsApp number owns or administers. Link each to its store so that store's manager can post to it; switch off any you don't use."
      >
        <div className="mb-4">
          <SyncButton />
        </div>
        {channels.length === 0 ? (
          <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">
            No channels yet. Press Sync once the number is connected in Whapi.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {channels.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", c.active ? "text-ink" : "text-faint")}>{c.name}</p>
                  <p className="truncate text-xs text-muted">
                    {c.whapi_channel_id}
                    {!c.in_last_sync && <span className="ml-1 font-medium text-high">· not found in last sync</span>}
                  </p>
                </div>
                <ChannelRowControls channel={c} stores={stores} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  }

  async function GroupsSection() {
    const [groups, channels] = await Promise.all([listGroups(), listChannels(v)]);
    const options = channels.map((c) => ({ id: c.id, name: c.name }));
    return (
      <Panel title="Groups" description='Named sets of channels, e.g. "All SUPERSPAR" or "All TOPS", to post to in one go.'>
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <GroupEditor key={g.id} group={g} channels={options} />
          ))}
          {channels.length === 0 ? (
            <p className="text-sm text-muted">Sync channels first, then group them here.</p>
          ) : (
            <GroupEditor channels={options} />
          )}
        </div>
      </Panel>
    );
  }
}

function StatusPill({ status }: { status: Post["status"] }) {
  const styles: Record<Post["status"], string> = {
    draft: "bg-subtle text-muted",
    scheduled: "bg-subtle text-ink",
    sending: "bg-high-tint text-high",
    sent: "bg-ok/10 text-ok",
    partial: "bg-high-tint text-high",
    failed: "bg-urgent-tint text-urgent",
  };
  const labels: Record<Post["status"], string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    sending: "Sending",
    sent: "Sent",
    partial: "Partly sent",
    failed: "Failed",
  };
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wide", styles[status])}>
      {labels[status]}
    </span>
  );
}
