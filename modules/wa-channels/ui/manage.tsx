"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";
import {
  cancelPost,
  deleteGroup,
  resumeSending,
  retryFailed,
  saveGroup,
  setChannelActive,
  setChannelStore,
  syncChannels,
  type Result,
} from "../actions";

/** Runs a server action and shows its outcome inline. */
function useAction() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result>({});
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setMsg({});
      setMsg(await fn());
    });
  return { pending, msg, run };
}

function Message({ msg }: { msg: Result }) {
  if (msg.error) return <p className="text-sm text-urgent">{msg.error}</p>;
  if (msg.ok) return <p className="text-sm text-ok">{msg.ok}</p>;
  return null;
}

// ---------------------------------------------------------------------------

export function SyncButton() {
  const { pending, msg, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => run(syncChannels)}>
        <RefreshCw className={cn("size-4", pending && "animate-spin")} /> Sync channels
      </Button>
      <Message msg={msg} />
    </div>
  );
}

type ChannelRow = {
  id: string;
  name: string;
  whapi_channel_id: string;
  store_id: string | null;
  active: boolean;
  in_last_sync: boolean;
};

export function ChannelRowControls({ channel, stores }: { channel: ChannelRow; stores: { id: string; name: string }[] }) {
  const [active, setActive] = useState(channel.active);
  const { pending, msg, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        defaultValue={channel.store_id ?? ""}
        onChange={(e) => run(() => setChannelStore(channel.id, e.target.value || null))}
        disabled={pending}
        aria-label={`Store for ${channel.name}`}
        className={cn(inputClass, "h-9 w-48")}
      >
        <option value="">No store (you only)</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Toggle
        name="active"
        value={channel.id}
        label={`${channel.name} active`}
        checked={active}
        onChange={(v) => {
          setActive(v);
          run(() => setChannelActive(channel.id, v));
        }}
      />
      {pending && <Loader2 className="size-4 animate-spin text-muted" />}
      {msg.error && <span className="text-xs text-urgent">{msg.error}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------

type Group = { id: string; name: string; channel_ids: string[] };

export function GroupEditor({ group, channels }: { group?: Group; channels: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(!group);
  const [name, setName] = useState(group?.name ?? "");
  const [ids, setIds] = useState<Set<string>>(new Set(group?.channel_ids ?? []));
  const { pending, msg, run } = useAction();

  if (group && !open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{group.name}</p>
          <p className="truncate text-xs text-muted">
            {group.channel_ids.length === 0
              ? "No channels"
              : channels.filter((c) => group.channel_ids.includes(c.id)).map((c) => c.name).join(", ")}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-4" /> Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => confirm(`Delete the group "${group.name}"? Channels aren't affected.`) && run(() => deleteGroup(group.id))}
        >
          <Trash2 className="size-4" />
        </Button>
        <Message msg={msg} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold-line bg-gold-tint/40 p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Group name, e.g. "All TOPS"' className={inputClass} />
      <div className="grid gap-1 rounded-xl border border-line bg-surface p-2 sm:grid-cols-2">
        {channels.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas">
            <input
              type="checkbox"
              checked={ids.has(c.id)}
              onChange={() =>
                setIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(c.id)) next.delete(c.id);
                  else next.add(c.id);
                  return next;
                })
              }
              className="size-4 accent-[var(--color-gold-strong)]"
            />
            <span className="truncate">{c.name}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await saveGroup(group?.id ?? null, name, [...ids]);
              if (r.ok && !group) {
                setName("");
                setIds(new Set());
              }
              if (r.ok && group) setOpen(false);
              return r;
            })
          }
        >
          {group ? "Save group" : (
            <>
              <Plus className="size-4" /> Create group
            </>
          )}
        </Button>
        {group && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
        <Message msg={msg} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PostActions({ postId, canRetry, canCancel }: { postId: string; canRetry: boolean; canCancel: boolean }) {
  const { pending, msg, run } = useAction();
  if (!canRetry && !canCancel) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRetry && (
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => run(() => retryFailed(postId))}>
          <RefreshCw className={cn("size-4", pending && "animate-spin")} /> Retry failed
        </Button>
      )}
      {canCancel && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => confirm("Cancel this scheduled post?") && run(() => cancelPost(postId))}
        >
          Cancel
        </Button>
      )}
      <Message msg={msg} />
    </div>
  );
}

export function ResumeButton() {
  const { pending, msg, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" disabled={pending} onClick={() => run(resumeSending)}>
        I&apos;ve re-scanned — resume
      </Button>
      <Message msg={msg} />
    </div>
  );
}
