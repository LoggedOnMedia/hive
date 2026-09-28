import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { listDepartments } from "@/lib/stores";
import { requireRegionalManager } from "@/lib/viewer";
import { NewStoreForm } from "../forms";

export const metadata: Metadata = { title: "Add store" };

export default async function NewStorePage() {
  await requireRegionalManager();
  const departments = await listDepartments();
  return (
    <div className="max-w-3xl">
      <Link href="/stores" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Stores
      </Link>
      <PageHeader title="Add store" />
      <Panel title="Store profile">
        <NewStoreForm departments={departments} />
      </Panel>
    </div>
  );
}
