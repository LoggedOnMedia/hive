import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Gauge, TimerReset } from "lucide-react";
import { Meter, StatTile, StatusCell, StatusLegend, pct } from "@/components/dashboard/parts";
import { PriorityPill } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { assetCaption } from "@/lib/assets";
import { cn } from "@/lib/cn";
import { getDashboard } from "@/lib/dashboard";
import { shortTime } from "@/lib/time";
import { requireRegionalManager } from "@/lib/viewer";

export const metadata: Metadata = { title: "Dashboard" };

const GRID_POSTS = 12;

export default async function DashboardPage() {
  await requireRegionalManager();
  const d = await getDashboard();

  if (d.posts.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description="Who has opened, downloaded and replied — per message, per store." />
        <div className="rounded-[var(--radius-card)] border border-line bg-surface">
          <EmptyState
            icon={<Gauge className="size-6" strokeWidth={1.8} />}
            title="No activity to report yet"
            action={<ButtonLink href="/compose">Send a message</ButtonLink>}
          >
            Once messages go out, you&apos;ll see who has opened and downloaded what, store by store.
          </EmptyState>
        </div>
      </>
    );
  }

  const { kpis } = d;
  const waiting = kpis.pairs - kpis.opened;
  const gridPosts = d.posts.slice(0, GRID_POSTS);
  // Only stores that received at least one of the grid's messages get a column.
  const gridStores = d.stores.filter((s) => gridPosts.some((p) => p.cells.has(s.id)));

  return (
    <>
      <PageHeader title="Dashboard" description="Who has opened, downloaded and replied — per message, per store." />

      {/* KPI row — last 30 days */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Messages sent" value={String(kpis.sent30)} caption="Last 30 days" />
        <StatTile
          label="Opened"
          value={pct(kpis.opened, kpis.pairs)}
          ratio={kpis.pairs ? kpis.opened / kpis.pairs : 0}
          caption={`${kpis.opened} of ${kpis.pairs} store deliveries`}
        />
        <StatTile
          label="Files downloaded"
          value={pct(kpis.filesDone, kpis.files)}
          ratio={kpis.files ? kpis.filesDone / kpis.files : 0}
          caption={kpis.files ? `${kpis.filesDone} of ${kpis.files} store downloads` : "No downloadable files sent"}
        />
        <StatTile
          label="Still unopened"
          value={String(waiting)}
          caption={waiting === 0 ? "Every store is up to date" : "Store deliveries nobody has opened"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* Store roster */}
        <Panel title="Stores" description="Across every message each store has received.">
          <div className="-mx-5 overflow-x-auto md:-mx-6">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-5 pb-2 font-medium md:px-6">Store</th>
                  <th className="pb-2 font-medium">Opened</th>
                  <th className="pb-2 font-medium">Files</th>
                  <th className="pb-2 pr-5 font-medium md:pr-6">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.stores.map((s) => (
                  <tr key={s.id} className="group">
                    <td className="px-5 py-3 md:px-6">
                      <Link href={`/dashboard/stores/${s.id}`} className="flex items-center gap-1 font-semibold text-ink group-hover:underline">
                        {s.name}
                        <ChevronRight className="size-3.5 text-faint" />
                      </Link>
                      <p className="text-xs text-muted">{s.managerName ?? "No manager login"}</p>
                    </td>
                    <td className="w-40 py-3 pr-4">
                      <p className="text-xs tabular-nums text-ink">
                        {s.opened} of {s.received}
                        {s.waitingPriority > 0 && (
                          <span className="ml-1.5 font-semibold text-urgent">· {s.waitingPriority} urgent/high waiting</span>
                        )}
                      </p>
                      <Meter ratio={s.received ? s.opened / s.received : 0} className="mt-1.5" />
                    </td>
                    <td className="w-32 py-3 pr-4">
                      {s.filesTotal > 0 ? (
                        <>
                          <p className="text-xs tabular-nums text-ink">
                            {s.filesDone} of {s.filesTotal}
                          </p>
                          <Meter ratio={s.filesDone / s.filesTotal} className="mt-1.5" />
                        </>
                      ) : (
                        <p className="text-xs text-faint">—</p>
                      )}
                    </td>
                    <td className="py-3 pr-5 text-xs text-muted md:pr-6">{s.lastActive ? shortTime(s.lastActive) : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Needs attention */}
        <Panel title="Needs attention" description="Urgent and high messages not yet opened, and links about to expire.">
          {d.attention.length === 0 ? (
            <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">Nothing needs chasing right now.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {d.attention.map((a) => (
                <li key={`${a.kind}-${a.postId}-${a.kind === "expiring" ? a.assetName : ""}`}>
                  <Link href={`/feed/${a.postId}`} className="flex gap-3 rounded-xl px-2 py-3 hover:bg-canvas">
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        a.kind === "expiring" ? "bg-high-tint text-high" : "bg-urgent-tint text-urgent",
                      )}
                    >
                      {a.kind === "expiring" ? <TimerReset className="size-4" /> : <AlertTriangle className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                      {a.kind === "expiring" ? (
                        <p className="text-xs text-muted">
                          <span className="font-medium text-high">
                            {assetCaption({ kind: "link", sizeBytes: null, expiresAt: a.expiresAt, expired: false })}
                          </span>{" "}
                          · {a.assetName}
                        </p>
                      ) : (
                        <p className="flex items-center gap-2 text-xs text-muted">
                          <PriorityPill priority={a.priority} className="h-5 px-2 text-[10px]" /> Sent {shortTime(a.createdAt)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-ink">
                        {a.kind === "expiring" ? "Not downloaded by " : "Not opened by "}
                        <span className="font-medium">{a.stores.join(", ")}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Message × store grid */}
      <div className="mt-4">
        <Panel title="Recent messages" description={`The latest ${gridPosts.length} messages, store by store. Hover a dot for details.`}>
          <div className="-mx-5 overflow-x-auto md:-mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="sticky left-0 z-10 min-w-56 bg-surface px-5 pb-2 text-left font-medium md:px-6">Message</th>
                  {gridStores.map((s) => (
                    <th key={s.id} className="px-1 pb-2 align-bottom font-medium" title={s.name}>
                      <span className="mx-auto line-clamp-2 block w-20 break-words text-center leading-tight">{s.name}</span>
                    </th>
                  ))}
                  <th className="px-5 pb-2 text-right font-medium md:px-6">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {gridPosts.map((p) => (
                  <tr key={p.id}>
                    <td className="sticky left-0 z-10 bg-surface px-5 py-2.5 md:px-6">
                      <Link href={`/feed/${p.id}`} className="block max-w-72 truncate font-medium text-ink hover:underline">
                        {p.title}
                      </Link>
                      <p className="text-xs text-muted">{shortTime(p.createdAt)}</p>
                    </td>
                    {gridStores.map((s) => (
                      <td key={s.id} className="px-1 py-2.5 text-center">
                        <StatusCell cell={p.cells.get(s.id)} storeName={s.name} />
                      </td>
                    ))}
                    <td
                      className={cn(
                        "px-5 py-2.5 text-right text-xs tabular-nums md:px-6",
                        p.openedCount === p.targetCount ? "text-ok" : "text-muted",
                      )}
                    >
                      {p.openedCount}/{p.targetCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <StatusLegend />
          </div>
        </Panel>
      </div>
    </>
  );
}
