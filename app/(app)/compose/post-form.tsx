"use client";

import { useActionState, useState } from "react";
import { createPost, updatePost } from "@/app/actions/posts";
import type { FormState } from "@/app/actions/stores";
import { PriorityPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/lib/cn";
import { PRIORITIES, PRIORITY_META, type Priority } from "@/lib/priority";
import { Attachments } from "./attachments";

const initial: FormState = {};

function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
        checked ? "border-gold bg-gold-tint" : "border-line bg-surface hover:bg-canvas",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 accent-[var(--color-gold-strong)]" />
      <span className="flex-1">{children}</span>
    </label>
  );
}

function PriorityPicker({ defaultValue }: { defaultValue: Priority }) {
  const [priority, setPriority] = useState<Priority>(defaultValue);
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">Priority</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {PRIORITIES.map((p) => (
          <ChoiceCard key={p} name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)}>
            <PriorityPill priority={p} />
            <span className="mt-1.5 block text-xs text-muted">{PRIORITY_META[p].description}</span>
          </ChoiceCard>
        ))}
      </div>
    </fieldset>
  );
}

export function ComposeForm({ stores }: { stores: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createPost, initial);
  const [audience, setAudience] = useState<"all" | "some">("all");
  const [replies, setReplies] = useState<"shared" | "private">("shared");

  return (
    <form action={action} className="flex flex-col gap-6">
      <Field label="Title">
        <input name="title" required maxLength={120} placeholder="e.g. Easter campaign goes live Friday" className={inputClass} />
      </Field>
      <Field label="Message">
        <textarea
          name="body"
          rows={6}
          placeholder="What do the stores need to know?"
          className={cn(inputClass, "h-auto py-3 leading-relaxed")}
        />
      </Field>

      <Attachments />

      <PriorityPicker defaultValue="normal" />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Send to</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard name="audience" value="all" checked={audience === "all"} onChange={() => setAudience("all")}>
            <span className="text-sm font-semibold text-ink">All stores</span>
            <span className="block text-xs text-muted">The {stores.length} stores in Hive right now</span>
          </ChoiceCard>
          <ChoiceCard name="audience" value="some" checked={audience === "some"} onChange={() => setAudience("some")}>
            <span className="text-sm font-semibold text-ink">Choose stores</span>
            <span className="block text-xs text-muted">One store or a few</span>
          </ChoiceCard>
        </div>
        {audience === "some" && (
          <div className="mt-3 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
            {stores.map((s) => (
              <label key={s.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas">
                <input type="checkbox" name="store" value={s.id} className="size-4 accent-[var(--color-gold-strong)]" />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Replies</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard name="replies" value="shared" checked={replies === "shared"} onChange={() => setReplies("shared")}>
            <span className="text-sm font-semibold text-ink">Shared</span>
            <span className="block text-xs text-muted">Every store sees all replies, labelled by store</span>
          </ChoiceCard>
          <ChoiceCard name="replies" value="private" checked={replies === "private"} onChange={() => setReplies("private")}>
            <span className="text-sm font-semibold text-ink">Private per store</span>
            <span className="block text-xs text-muted">Each store only sees its own conversation with you</span>
          </ChoiceCard>
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}

export function EditPostForm({
  postId,
  title,
  body,
  priority,
}: {
  postId: string;
  title: string;
  body: string;
  priority: Priority;
}) {
  const [state, action, pending] = useActionState(updatePost.bind(null, postId), initial);
  return (
    <form action={action} className="flex flex-col gap-6">
      <Field label="Title">
        <input name="title" required maxLength={120} defaultValue={title} className={inputClass} />
      </Field>
      <Field label="Message">
        <textarea name="body" rows={6} defaultValue={body} className={cn(inputClass, "h-auto py-3 leading-relaxed")} />
      </Field>
      <PriorityPicker defaultValue={priority} />
      <p className="text-xs text-muted">
        Stores will see an &ldquo;Edited&rdquo; label. Who it was sent to and how replies work can&apos;t be changed after sending.
      </p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
