import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { HiveLogo, HiveMark } from "@/components/brand/logo";
import { AttachmentCard } from "@/components/feed/attachment-card";
import { PostCard } from "@/components/feed/post-card";
import { Avatar } from "@/components/ui/avatar";
import { CountBadge, PriorityPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PRIORITIES, PRIORITY_META } from "@/lib/priority";

export const metadata: Metadata = { title: "Design system" };

// Living reference for the Hive visual language. Not linked from the nav.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">{title}</h2>
      {children}
    </section>
  );
}

const swatches = [
  ["gold", "bg-gold"],
  ["gold-strong", "bg-gold-strong"],
  ["gold-tint", "bg-gold-tint"],
  ["ink", "bg-ink"],
  ["chrome", "bg-chrome"],
  ["chrome-raised", "bg-chrome-raised"],
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["line", "bg-line"],
  ["muted", "bg-muted"],
  ["urgent", "bg-urgent"],
] as const;

export default function DesignPage() {
  return (
    <>
      <PageHeader title="Design system" description="The Hive visual language — reference for every screen." />

      <Section title="Logo">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex h-32 items-center justify-center rounded-2xl border border-line bg-surface">
            <HiveLogo className="h-14 w-auto" />
          </div>
          <div className="flex h-32 items-center justify-center rounded-2xl bg-chrome">
            <HiveLogo tone="light" className="h-14 w-auto" />
          </div>
          <div className="flex h-32 items-center justify-center rounded-2xl border border-line bg-surface">
            <HiveMark className="h-16 w-auto" />
          </div>
        </div>
      </Section>

      <Section title="Colour">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {swatches.map(([name, cls]) => (
            <div key={name}>
              <div className={`h-14 rounded-xl border border-line ${cls}`} />
              <p className="mt-1.5 text-xs text-muted">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Priority">
        <div className="flex flex-col gap-2">
          {PRIORITIES.map((p) => (
            <div key={p} className="flex items-center gap-3">
              <PriorityPill priority={p} className="w-20 justify-center" />
              <span className="text-sm text-muted">{PRIORITY_META[p].description}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Plus className="size-4" strokeWidth={2.4} /> New message
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete message</Button>
          <CountBadge count={3} />
          <CountBadge count={12} />
          <Avatar name="Eugene" tone="gold" />
          <Avatar name="Grove TOPS" />
        </div>
      </Section>

      <Section title="Feed cards (sample content)">
        <div className="flex max-w-2xl flex-col gap-3">
          <PostCard
            href="/design"
            title="Easter campaign goes live Friday"
            preview="Artwork and store guidelines are attached. Please make sure all displays are set up before opening on Friday."
            priority="urgent"
            timeLabel="09:12"
            unseen
            replies={2}
          >
            <AttachmentCard name="Easter_Artwork_SPAR.pdf" kind="pdf" caption="24 MB" />
            <AttachmentCard name="Easter print files" kind="link" caption="Expires in 2 days" expiringSoon />
            <AttachmentCard name="In-store_examples.jpg" kind="image" caption="3.2 MB" downloadable={false} />
            <AttachmentCard name="Christmas print files" kind="link" caption="Link expired 20 Dec" expired />
          </PostCard>
          <PostCard
            href="/design"
            title="Quarterly meeting — agenda"
            preview="Please review the agenda before Thursday and drop any items you want added in the thread."
            priority="high"
            timeLabel="Yesterday"
            replies={1}
          />
          <PostCard
            href="/design"
            title="Updated trading hours template"
            preview="New template for the public holiday trading hours notice."
            priority="normal"
            timeLabel="Mon"
          />
          <PostCard
            href="/design"
            title="Reference: shelf-strip examples"
            preview="For reference only — no action needed."
            priority="low"
            timeLabel="12 Sep"
          />
        </div>
      </Section>
    </>
  );
}
