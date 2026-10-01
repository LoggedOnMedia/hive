"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarClock, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { createWaPost, getMediaUploadUrl } from "../actions";
import { WhatsAppText } from "./wa-format";

type Channel = { id: string; name: string; store_name: string | null };
type Group = { id: string; name: string; channel_ids: string[] };
type Item = { key: string; file: File; preview: string; kind: "image" | "video" };

const MAX = 16 * 1024 * 1024;
const MAX_ITEMS = 10;
const CAPTION_MAX_ON_MEDIA = 1024;
const TYPES = ["image/jpeg", "image/png", "video/mp4"];

/** "YYYY-MM-DDTHH:mm" picked in SA time → UTC ISO string. */
const saToUtc = (local: string) => new Date(`${local}:00+02:00`).toISOString();

export function NewPostForm({ channels, groups, isRM }: { channels: Channel[]; groups: Group[]; isRM: boolean }) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  // A store manager with one channel has it pre-selected.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(!isRM && channels.length === 1 ? [channels[0].id] : []));
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [when, setWhen] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  // Channels reached = picked channels + every channel in picked groups (no duplicates).
  const reach = useMemo(() => {
    const ids = new Set(selected);
    for (const g of groups) if (selectedGroups.has(g.id)) g.channel_ids.forEach((c) => ids.add(c));
    return channels.filter((c) => ids.has(c.id));
  }, [selected, selectedGroups, groups, channels]);

  const toggle = (set: Set<string>, id: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };

  const pickFiles = (files: FileList | null) => {
    setError("");
    if (!files) return;
    const added: Item[] = [];
    for (const file of Array.from(files)) {
      if (!TYPES.includes(file.type)) {
        setError(`"${file.name}" isn't a JPEG, PNG or MP4.`);
        continue;
      }
      if (file.size > MAX) {
        setError(`"${file.name}" is over 16 MB — WhatsApp's limit for channel media.`);
        continue;
      }
      added.push({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        kind: file.type.startsWith("video/") ? "video" : "image",
      });
    }
    setItems((list) => {
      const next = [...list, ...added];
      if (next.length > MAX_ITEMS) setError(`Up to ${MAX_ITEMS} images or videos per post — the extra ones weren't added.`);
      return next.slice(0, MAX_ITEMS);
    });
    if (fileInput.current) fileInput.current.value = "";
  };

  const move = (i: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  // Wraps the selected caption text in a WhatsApp formatting marker. Spaces at
  // the edges of the selection (Windows double-click often grabs one) are left
  // outside the markers: WhatsApp ignores "* word*" but formats "*word*".
  const wrap = (marker: string) => {
    const el = captionRef.current;
    if (!el) return;
    const { value } = el;
    let a = el.selectionStart;
    let b = el.selectionEnd;
    while (a < b && /\s/.test(value[a])) a++;
    while (b > a && /\s/.test(value[b - 1])) b--;
    const next = value.slice(0, a) + marker + value.slice(a, b) + marker + value.slice(b);
    setCaption(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + marker.length, b + marker.length);
    });
  };

  const submit = () =>
    start(async () => {
      setError("");
      setOk("");
      if (!caption.trim() && items.length === 0) return setError("Add an image or video, some text, or both.");
      if (reach.length === 0) return setError("Choose at least one channel.");
      if (mode === "schedule" && !when) return setError("Pick a date and time.");

      // Upload each file straight to storage, in order.
      const media: { path: string; mime: string }[] = [];
      for (const [i, item] of items.entries()) {
        setStatus(`Uploading ${i + 1} of ${items.length}…`);
        const up = await getMediaUploadUrl(item.file.name, item.file.size, item.file.type);
        if (up.error || !up.url || !up.path) {
          setStatus("");
          return setError(up.error ?? `Couldn't upload "${item.file.name}".`);
        }
        const form = new FormData();
        form.append("cacheControl", "3600");
        form.append("", item.file);
        const res = await fetch(up.url, { method: "PUT", body: form, headers: { "x-upsert": "false" } });
        if (!res.ok) {
          setStatus("");
          return setError(`Uploading "${item.file.name}" failed (${res.status}).`);
        }
        media.push({ path: up.path, mime: item.file.type });
      }

      setStatus(mode === "now" ? "Queuing…" : "Scheduling…");
      const result = await createWaPost({
        caption,
        media,
        channelIds: [...selected],
        groupIds: [...selectedGroups],
        scheduledAt: mode === "schedule" ? saToUtc(when) : null,
      });
      setStatus("");
      if (result.error) return setError(result.error);
      setOk(result.ok ?? "Done");
      setCaption("");
      setItems([]);
      setSelectedGroups(new Set());
      if (isRM) setSelected(new Set());
      router.push("/whatsapp");
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 md:p-6">
        {/* Images & video */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Images &amp; video</p>
          {items.length > 0 && (
            <ul className="mb-2 flex flex-col gap-2">
              {items.map((item, i) => (
                <li key={item.key} className="flex items-center gap-3 rounded-xl border border-line p-2">
                  <span className="w-5 text-center text-xs font-semibold text-faint">{i + 1}</span>
                  {item.kind === "video" ? (
                    <video src={item.preview} muted playsInline preload="metadata" className="size-14 rounded-lg bg-subtle object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img src={item.preview} alt="" className="size-14 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.file.name}</p>
                    <p className="text-xs text-muted">
                      {item.kind === "video" ? "Video" : "Image"} · {(item.file.size / 1024 / 1024).toFixed(1)} MB
                      {i === items.length - 1 && caption.trim() && caption.trim().length <= CAPTION_MAX_ON_MEDIA && " · caption goes here"}
                    </p>
                  </div>
                  <div className="flex">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="rounded-full p-1.5 text-faint hover:bg-subtle hover:text-ink disabled:opacity-30">
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="rounded-full p-1.5 text-faint hover:bg-subtle hover:text-ink disabled:opacity-30">
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => setItems((l) => l.filter((x) => x.key !== item.key))} aria-label="Remove" className="rounded-full p-1.5 text-faint hover:bg-subtle hover:text-urgent">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,video/mp4" className="sr-only" onChange={(e) => pickFiles(e.target.files)} />
          {items.length < MAX_ITEMS && (
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
              <ImagePlus className="size-4" strokeWidth={1.8} /> {items.length ? "Add more" : "Add images or video"}
            </Button>
          )}
          <p className="mt-1.5 text-xs text-muted">
            Optional. Up to {MAX_ITEMS} JPEG/PNG images or MP4 videos, 16 MB each. Each goes out as its own post, in this
            order, with the caption on the last one.
          </p>
        </div>

        {/* Caption */}
        <Field label="Caption">
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1">
              {[
                ["*", "B", "font-bold"],
                ["_", "I", "italic"],
                ["~", "S", "line-through"],
                ["```", "</>", "font-mono text-[11px]"],
              ].map(([m, label, cls]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => wrap(m)}
                  title={`Wrap selection in ${m}`}
                  className={cn("h-8 min-w-8 rounded-lg border border-line px-2 text-sm text-ink hover:bg-subtle", cls)}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              ref={captionRef}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              maxLength={4096}
              placeholder="What do you want to post? *bold*  _italic_  ~strike~"
              className={cn(inputClass, "h-auto py-3 leading-relaxed")}
            />
          </div>
        </Field>

        {/* Channels & groups */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Post to</p>
          {channels.length === 0 ? (
            <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-muted">
              {isRM ? "No channels yet — sync them on the Channels tab." : "No WhatsApp channel is linked to your store yet. Ask your regional manager to link one."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {isRM && groups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggle(selectedGroups, g.id, setSelectedGroups)}
                      className={cn(
                        "h-9 rounded-full px-3.5 text-sm font-medium",
                        selectedGroups.has(g.id) ? "bg-gold text-ink" : "border border-line bg-surface text-muted hover:text-ink",
                      )}
                    >
                      {g.name} <span className="text-xs opacity-70">{g.channel_ids.length}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-1 rounded-xl border border-line p-2 sm:grid-cols-2">
                {channels.map((c) => {
                  const viaGroup = !selected.has(c.id) && reach.some((r) => r.id === c.id);
                  return (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id) || viaGroup}
                        disabled={viaGroup}
                        onChange={() => toggle(selected, c.id, setSelected)}
                        className="size-4 accent-[var(--color-gold-strong)]"
                      />
                      <span className="truncate">{c.name}</span>
                      {viaGroup && <span className="ml-auto text-[10px] uppercase tracking-wide text-faint">via group</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* When */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">When</p>
          <div className="flex flex-wrap items-center gap-2">
            {(["now", "schedule"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "h-9 rounded-full px-4 text-sm font-medium",
                  mode === m ? "bg-gold text-ink" : "border border-line bg-surface text-muted hover:text-ink",
                )}
              >
                {m === "now" ? "Post now" : "Schedule"}
              </button>
            ))}
            {mode === "schedule" && (
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className={cn(inputClass, "h-9 w-auto")}
                aria-label="Send at (South African time)"
              />
            )}
          </div>
          {mode === "schedule" && <p className="mt-1.5 text-xs text-muted">South African time.</p>}
        </div>

        {error && <p role="alert" className="rounded-xl bg-urgent-tint px-3 py-2 text-sm text-urgent">{error}</p>}
        {ok && <p className="text-sm font-medium text-ok">{ok}</p>}

        <div className="flex items-center gap-3">
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : mode === "now" ? <Send className="size-4" /> : <CalendarClock className="size-4" />}
            {mode === "now" ? "Post now" : "Schedule"}
            {reach.length > 0 && ` · ${reach.length} ${reach.length === 1 ? "channel" : "channels"}`}
          </Button>
          {status && <span className="text-sm text-muted">{status}</span>}
        </div>
        {reach.length > 1 && (
          <p className="-mt-2 text-xs text-muted">Channels are posted to one at a time, 10–20 seconds apart, to keep the number safe.</p>
        )}
      </div>

      {/* Preview */}
      <aside className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-faint">Preview</p>
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-[#efeae2] p-4">
          {/* One bubble per post, in order; the caption rides on the last media
              item, or follows as its own post when it's too long for a caption. */}
          {items.map((item, i) => {
            const captionHere = i === items.length - 1 && caption.trim() && caption.trim().length <= CAPTION_MAX_ON_MEDIA;
            return (
              <div key={item.key} className="max-w-[300px] overflow-hidden rounded-xl bg-white shadow-sm">
                {item.kind === "video" ? (
                  <video src={item.preview} controls muted playsInline preload="metadata" className="w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={item.preview} alt="" className="w-full object-cover" />
                )}
                {captionHere && (
                  <p className="break-words px-3 py-2 text-[14px] leading-snug text-[#111b21]">
                    <WhatsAppText text={caption} />
                  </p>
                )}
              </div>
            );
          })}
          {(items.length === 0 || caption.trim().length > CAPTION_MAX_ON_MEDIA) && (
            <div className="max-w-[300px] rounded-xl bg-white shadow-sm">
              <p className="break-words px-3 py-2 text-[14px] leading-snug text-[#111b21]">
                {caption ? <WhatsAppText text={caption} /> : <span className="text-faint">Your caption will appear here.</span>}
              </p>
            </div>
          )}
        </div>
        {items.length > 0 && caption.trim().length > CAPTION_MAX_ON_MEDIA && (
          <p className="text-xs text-muted">
            The text is longer than WhatsApp allows on a photo or video (1,024 characters), so it goes out as its own post
            after them.
          </p>
        )}
        {items.length > 1 && reach.length > 0 && (
          <p className="text-xs text-muted">
            {items.length + (caption.trim().length > CAPTION_MAX_ON_MEDIA ? 1 : 0)} posts per channel ×{" "}
            {reach.length} {reach.length === 1 ? "channel" : "channels"} ={" "}
            {(items.length + (caption.trim().length > CAPTION_MAX_ON_MEDIA ? 1 : 0)) * reach.length} messages.
          </p>
        )}
      </aside>
    </div>
  );
}
