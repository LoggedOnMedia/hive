import type { Metadata } from "next";
import { PenLine } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRegionalManager } from "@/lib/viewer";

export const metadata: Metadata = { title: "New message" };

export default async function ComposePage() {
  await requireRegionalManager();
  return (
    <>
      <PageHeader title="New message" description="Choose stores, set a priority, attach campaign assets." />
      <div className="rounded-[var(--radius-card)] border border-line bg-surface">
        <EmptyState icon={<PenLine className="size-6" strokeWidth={1.8} />} title="Compose arrives in step 3">
          This is where messages and campaign artwork will be sent to one store, several stores, or all of them.
        </EmptyState>
      </div>
    </>
  );
}
