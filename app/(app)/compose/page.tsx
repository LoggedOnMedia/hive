import type { Metadata } from "next";
import { Store } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { listStores } from "@/lib/stores";
import { requireRegionalManager } from "@/lib/viewer";
import { ComposeForm } from "./post-form";

export const metadata: Metadata = { title: "New message" };

export default async function ComposePage() {
  await requireRegionalManager();
  const stores = await listStores();

  return (
    <div className="max-w-3xl">
      <PageHeader title="New message" />
      {stores.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface">
          <EmptyState
            icon={<Store className="size-6" strokeWidth={1.8} />}
            title="Add a store first"
            action={<ButtonLink href="/stores/new">Add store</ButtonLink>}
          >
            Messages go to stores, so you&apos;ll need at least one.
          </EmptyState>
        </div>
      ) : (
        <Panel title="Message">
          <ComposeForm stores={stores.map((s) => ({ id: s.id, name: s.name }))} />
        </Panel>
      )}
    </div>
  );
}
