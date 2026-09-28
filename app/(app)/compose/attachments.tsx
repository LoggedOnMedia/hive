"use client";

import { useRef, useState } from "react";
import { Eye, FileText, Image as ImageIcon, Link2, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";
import { MAX_UPLOAD_BYTES, formatBytes, type AssetInput } from "@/lib/assets";
import { createClient } from "@/lib/supabase/client";

type Item =
  | { key: string; state: "uploading"; name: string; size: number }
  | { key: string; state: "failed"; name: string; error: string }
  | { key: string; state: "ready"; asset: AssetInput };

const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120);

/** SwissTransfer-style dates are picked as a day; the link works until the end of that day (SA time). */
const endOfDaySA = (date: string) => (date ? `${date}T23:59:59+02:00` : null);

/**
 * Attachment list for the compose form. Files upload straight to storage as
 * they're picked; the finished list is submitted as JSON in `assets`.
 */
export function Attachments() {
  const [items, setItems] = useState<Item[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (key: string, next: Item | null) =>
    setItems((list) => (next ? list.map((i) => (i.key === key ? next : i)) : list.filter((i) => i.key !== key)));

  async function upload(files: FileList) {
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const key = crypto.randomUUID();
      if (file.size > MAX_UPLOAD_BYTES) {
        setItems((l) => [
          ...l,
          { key, state: "failed", name: file.name, error: `${formatBytes(file.size)} is over the 50 MB upload limit — add it as a download link instead.` },
        ]);
        continue;
      }
      setItems((l) => [...l, { key, state: "uploading", name: file.name, size: file.size }]);
      const path = `uploads/${key}/${safeName(file.name)}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, { contentType: file.type || undefined });
      update(
        key,
        error
          ? { key, state: "failed", name: file.name, error: error.message }
          : {
              key,
              state: "ready",
              asset: {
                kind: "file",
                name: file.name,
                storage_path: path,
                mime_type: file.type,
                size_bytes: file.size,
                downloadable: true,
              },
            },
      );
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function remove(item: Item) {
    update(item.key, null);
    if (item.state === "ready" && item.asset.kind === "file") {
      await createClient().storage.from("assets").remove([item.asset.storage_path]);
    }
  }

  const ready = items.flatMap((i) => (i.state === "ready" ? [i.asset] : []));
  const busy = items.some((i) => i.state === "uploading");

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">Attachments</legend>
      <input type="hidden" name="assets" value={JSON.stringify(ready)} />
      {/* Blocks submit while uploads are in flight. */}
      {busy && <input type="hidden" name="uploading" value="1" />}

      {items.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <ItemIcon item={item} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.state === "ready" ? item.asset.name : item.name}</p>
                <ItemCaption item={item} />
              </div>
              {item.state === "ready" && item.asset.kind === "file" && (
                <div className="flex items-center gap-2 text-xs text-muted" title="Off = preview only: stores can view it but not download or forward it">
                  <span className="hidden sm:inline">Downloadable</span>
                  <Toggle
                    name="_downloadable"
                    value="1"
                    label="Downloadable"
                    checked={item.asset.downloadable}
                    onChange={(v) => update(item.key, { ...item, asset: { ...item.asset, downloadable: v } as AssetInput })}
                  />
                </div>
              )}
              {item.state !== "uploading" && (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label="Remove attachment"
                  className="flex size-9 items-center justify-center rounded-full text-faint hover:bg-subtle hover:text-urgent"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {linkOpen ? (
        <LinkForm
          onAdd={(asset) => {
            setItems((l) => [...l, { key: crypto.randomUUID(), state: "ready", asset }]);
            setLinkOpen(false);
          }}
          onCancel={() => setLinkOpen(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files?.length && upload(e.target.files)}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" strokeWidth={1.8} /> Upload files
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setLinkOpen(true)}>
            <Link2 className="size-4" strokeWidth={1.8} /> Add download link
          </Button>
          <p className="basis-full text-xs text-muted">
            Upload files up to 50 MB. For bigger artwork, add a SwissTransfer (or similar) link with its expiry date.
          </p>
        </div>
      )}
    </fieldset>
  );
}

function ItemIcon({ item }: { item: Item }) {
  const box = "flex size-10 shrink-0 items-center justify-center rounded-xl";
  if (item.state === "uploading") return <span className={cn(box, "bg-subtle text-muted")}><Loader2 className="size-5 animate-spin" /></span>;
  if (item.state === "failed") return <span className={cn(box, "bg-urgent-tint text-urgent")}><Paperclip className="size-5" /></span>;
  const a = item.asset;
  if (a.kind === "link") return <span className={cn(box, "bg-gold-tint text-high")}><Link2 className="size-5" /></span>;
  if (!a.downloadable) return <span className={cn(box, "bg-subtle text-muted")}><Eye className="size-5" /></span>;
  if (a.mime_type.startsWith("image/")) return <span className={cn(box, "bg-gold-tint text-high")}><ImageIcon className="size-5" /></span>;
  return <span className={cn(box, "bg-urgent-tint text-urgent")}><FileText className="size-5" /></span>;
}

function ItemCaption({ item }: { item: Item }) {
  if (item.state === "uploading") return <p className="text-xs text-muted">Uploading · {formatBytes(item.size)}</p>;
  if (item.state === "failed") return <p className="text-xs text-urgent">{item.error}</p>;
  const a = item.asset;
  if (a.kind === "link") {
    const host = new URL(a.url).host.replace(/^www\./, "");
    const exp = a.expires_at
      ? new Date(a.expires_at).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" })
      : null;
    return <p className="truncate text-xs text-muted">Link · {host}{exp ? ` · expires ${exp}` : " · no expiry"}</p>;
  }
  return (
    <p className="text-xs text-muted">
      {formatBytes(a.size_bytes)}
      {!a.downloadable && " · Preview only"}
    </p>
  );
}

function LinkForm({ onAdd, onCancel }: { onAdd: (a: AssetInput) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [expires, setExpires] = useState("");
  const [error, setError] = useState("");

  function add() {
    try {
      const u = new URL(url.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      return setError("Paste the full link, starting with https://");
    }
    if (!name.trim()) return setError("Give the link a name, e.g. “Easter artwork (print files)”.");
    onAdd({ kind: "link", name: name.trim(), url: url.trim(), expires_at: endOfDaySA(expires), downloadable: true });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold-line bg-gold-tint/50 p-4">
      <Field label="Link">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.swisstransfer.com/d/…" className={inputClass} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Easter artwork — print files" className={inputClass} />
        </Field>
        <Field label="Expires on" hint="Last day it works">
          <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={inputClass} />
        </Field>
      </div>
      {error && <p className="text-sm text-urgent">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={add}>Add link</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
