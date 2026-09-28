import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getPost } from "@/lib/posts";
import { requireRegionalManager } from "@/lib/viewer";
import { EditPostForm } from "../../../compose/post-form";

export const metadata: Metadata = { title: "Edit message" };

export default async function EditPostPage({ params }: PageProps<"/feed/[id]/edit">) {
  const viewer = await requireRegionalManager();
  const post = await getPost((await params).id, viewer);
  if (!post) notFound();

  return (
    <div className="max-w-3xl">
      <Link href={`/feed/${post.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Back to message
      </Link>
      <PageHeader title="Edit message" />
      <Panel title="Message">
        <EditPostForm postId={post.id} title={post.title} body={post.body} priority={post.priority} />
      </Panel>
    </div>
  );
}
