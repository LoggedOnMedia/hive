import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, Settings } from "lucide-react";
import { StatTile, StatusCell, pct } from "@/components/dashboard/parts";
import { PriorityPill } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { getDashboard, storeHistory } from "@/lib/dashboard";
import { shortTime } from "@/lib/time";
import { requireRegionalManager } from "@/lib/viewer";

export const metadata: Metadata = { title: "Store activity" };

export default async function StoreActivityPage({ params }: PageProps<"/dashboard/stores/[id]">) {
  await requireRegionalManager();
  const { id } = await params;
  const d = await getDashboard();
  const store = d.stores.find((s) => s.id === id);
  if (!store) notFound();
  const history = storeHistory(d, id);

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Dashboard
      </Link>
      <PageHeader
        title={store.name}
        description={store.managerName ? `Store manager: ${store.managerName}` : "No manager login yet"}
        actions={
          <ButtonLink href={`/stores/${store.id}`} variant="secondary" size="sm">
            <Settings className="size-4" strokeWidth={1.8} /> Store profile
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Messages received" value={String(store.received)} />
        <StatTile
          label="Opened"
          value={pct(store.opened, store.received)}
          ratio={store.received ? store.opened / store.received : 0}
          caption={`${store.opened} of ${store.received}`}
        />
        <StatTile
          label="Files downloaded"
          value={pct(store.filesDone, store.filesTotal)}
          ratio={store.filesTotal ? store.filesDone / store.filesTotal : 0}
          caption={store.filesTotal ? `${store.filesDone} of ${store.filesTotal}` : "No downloadable files yet"}
        />
        <StatTile
          label="Last active"
          value={store.lastActive ? shortTime(store.lastActive) : "Never"}
          caption="Opened, downloaded or replied"
        />
      </div>

      <div className="mt-4">
        <Panel title="Every message sent to this store" description="Newest first.">
          {history.length === 0 ? (
            <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">Nothing has been sent to this store yet.</p>
          ) : (
            <ul className="-mx-2 flex flex-col divide-y divide-line">
              {history.map((h) => (
                <li key={h.postId}>
                  <Link href={`/feed/${h.postId}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-canvas">
                    <StatusCell cell={h.cell} storeName={store.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{h.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <PriorityPill priority={h.priority} className="h-5 px-2 text-[10px]" />
                        Sent {shortTime(h.createdAt)}
                        {h.cell.replied && (
                          <span className="flex items-center gap-1">
                            <MessageCircle className="size-3" /> Replied
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className={cn(h.cell.seenAt ? "text-ink" : "font-medium text-urgent")}>
                        {h.cell.seenAt ? `Opened ${shortTime(h.cell.seenAt)}` : "Not opened"}
                      </p>
                      {h.cell.filesTotal > 0 && (
                        <p className={cn(h.cell.filesDone === h.cell.filesTotal ? "text-ok" : "text-muted")}>
                          Files {h.cell.filesDone}/{h.cell.filesTotal}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
