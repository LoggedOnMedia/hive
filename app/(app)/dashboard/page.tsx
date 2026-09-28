import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRegionalManager } from "@/lib/viewer";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireRegionalManager();
  return (
    <>
      <PageHeader title="Dashboard" description="Who has seen, downloaded and forwarded what — per message, per store." />
      <div className="rounded-[var(--radius-card)] border border-line bg-surface">
        <EmptyState icon={<Gauge className="size-6" strokeWidth={1.8} />} title="No activity to report yet">
          Once messages go out, you&apos;ll see seen, download and forward status for every store here.
        </EmptyState>
      </div>
    </>
  );
}
