"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { createWaPost, getImageUploadUrl } from "../actions";
import { WhatsAppText } from "./wa-format";

type Channel = { id: string; name: string; store_name: string | null };
type Group = { id: string; name: string; channel_ids: string[] };

const MAX = 16 * 1024 * 1024;

/** "YYYY-MM-DDTHH:mm" picked in SA time → UTC ISO string. */
const saToUtc = (local: string) => new Date(`${local}:00+02:00`).toISOString();

export function NewPostForm({ channels, groups, isRM }: { channels: Channel[]; groups: Group[]; isRM: boolean }) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
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

  const pickImage = (file?: File) => {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) return setError("Use a JPEG or PNG image.");
    if (file.size > MAX) return setError("Images must be under 16 MB.");
    setImage({ file, preview: URL.createObjectURL(file) });
  };

  // Wraps the selected caption text in a WhatsApp formatting marker.
  const wrap = (marker: string) => {
    const el = captionRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
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
      if (!caption.trim() && !image) return setError("Add an image, some text, or both.");
      if (reach.length === 0) return setError("Choose at least one channel.");
      if (mode === "schedule" && !when) return setError("Pick a date and time.");

      let mediaPath: string | null = null;
      if (image) {
        setStatus("Uploading image…");
        const up = await getImageUploadUrl(image.file.name, image.file.size, image.file.type);
        if (up.error || !up.url || !up.path) {
          setStatus("");
          return setError(up.error ?? "Couldn't upload the image.");
        }
        const form = new FormData();
        form.append("cacheControl", "3600");
        form.append("", image.file);
        const res = await fetch(up.url, { method: "PUT", body: form, headers: { "x-upsert": "false" } });
        if (!res.ok) {
          setStatus("");
          return setError(`Uploading the image failed (${res.status}).`);
        }
        mediaPath = up.path;
      }

      setStatus(mode === "now" ? "Queuing…" : "Scheduling…");
      const result = await createWaPost({
        caption,
        mediaPath,
        mediaMime: image?.file.type ?? null,
        channelIds: [...selected],
        groupIds: [...selectedGroups],
        scheduledAt: mode === "schedule" ? saToUtc(when) : null,
      });
      setStatus("");
      if (result.error) return setError(result.error);
      setOk(result.ok ?? "Done");
      setCaption("");
      setImage(null);
      setSelectedGroups(new Set());
      if (isRM) setSelected(new Set());
      router.push("/whatsapp");
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 md:p-6">
        {/* Image */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Image</p>
          {image ? (
            <div className="flex items-center gap-3 rounded-xl border border-line p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={image.preview} alt="" className="size-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{image.file.name}</p>
                <p className="text-xs text-muted">{(image.file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button type="button" onClick={() => setImage(null)} aria-label="Remove image" className="rounded-full p-2 text-faint hover:bg-subtle hover:text-urgent">
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                <ImagePlus className="size-4" strokeWidth={1.8} /> Add image
              </Button>
              <span className="ml-2 text-xs text-muted">JPEG or PNG, up to 16 MB. Optional.</span>
            </>
          )}
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
        <div className="rounded-[var(--radius-card)] bg-[#efeae2] p-4">
          <div className="max-w-[300px] overflow-hidden rounded-xl bg-white shadow-sm">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={image.preview} alt="" className="w-full object-cover" />
            )}
            {(caption || !image) && (
              <p className="break-words px-3 py-2 text-[14px] leading-snug text-[#111b21]">
                {caption ? <WhatsAppText text={caption} /> : <span className="text-faint">Your caption will appear here.</span>}
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
