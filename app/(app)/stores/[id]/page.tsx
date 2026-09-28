import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getStore } from "@/lib/stores";
import { requireRegionalManager } from "@/lib/viewer";
import { CreateManagerForm, DepartmentsForm, ResetPasswordForm, StoreDetailsForm } from "../forms";

export async function generateMetadata({ params }: PageProps<"/stores/[id]">): Promise<Metadata> {
  const store = await getStore((await params).id);
  return { title: store?.name ?? "Store" };
}

export default async function StorePage({ params }: PageProps<"/stores/[id]">) {
  await requireRegionalManager();
  const store = await getStore((await params).id);
  if (!store) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/stores" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Stores
      </Link>
      <PageHeader title={store.name} description={store.location ?? undefined} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Panel
            title="Departments"
            description="Stores forward campaign assets to these addresses. Only switched-on departments with an email are offered."
          >
            <DepartmentsForm storeId={store.id} departments={store.departments} />
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel
            title="Store manager"
            description={store.manager ? undefined : "Create the login they'll use on their phone."}
          >
            {store.manager ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={store.manager.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{store.manager.name}</p>
                    <p className="truncate text-xs text-muted">{store.manager.email}</p>
                  </div>
                </div>
                <ResetPasswordForm storeId={store.id} />
              </div>
            ) : (
              <CreateManagerForm storeId={store.id} />
            )}
          </Panel>
          <Panel title="Store details">
            <StoreDetailsForm storeId={store.id} name={store.name} location={store.location} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
