import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Store } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { listDepartments, listStores } from "@/lib/stores";
import { requireRegionalManager } from "@/lib/viewer";

export const metadata: Metadata = { title: "Stores" };

export default async function StoresPage() {
  await requireRegionalManager();
  const [stores, departments] = await Promise.all([listStores(), listDepartments()]);

  const addButton = (
    <ButtonLink href="/stores/new">
      <Plus className="size-4" strokeWidth={2.4} />
      Add store
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        title="Stores"
        description="Store profiles, their managers, and which departments each store has."
        actions={stores.length > 0 && addButton}
      />
      {stores.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface">
          <EmptyState icon={<Store className="size-6" strokeWidth={1.8} />} title="No stores yet" action={addButton}>
            Add each store, switch off the departments it doesn&apos;t have, then create its manager&apos;s login.
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {stores.map((s) => (
            <li key={s.id}>
              <Link href={`/stores/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas md:px-5">
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {s.name}
                    {s.location && <span className="font-normal text-muted"> · {s.location}</span>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {s.manager ? s.manager.name : <span className="font-medium text-high">No manager login yet</span>}
                    {" · "}
                    {s.enabledDepartments} of {departments.length} departments
                  </p>
                </div>
                <ChevronRight className="size-4 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
