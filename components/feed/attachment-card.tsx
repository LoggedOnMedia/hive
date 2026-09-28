import { Check, Download, Eye, FileText, Image as ImageIcon, Link2, TimerOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FileKind } from "@/lib/assets";

const kindStyles: Record<FileKind, { icon: typeof FileText; className: string; label: string }> = {
  pdf: { icon: FileText, className: "bg-urgent-tint text-urgent", label: "PDF" },
  image: { icon: ImageIcon, className: "bg-gold-tint text-high", label: "Image" },
  link: { icon: Link2, className: "bg-gold-tint text-high", label: "Download link" },
  other: { icon: FileText, className: "bg-subtle text-muted", label: "File" },
};

/**
 * One attachment as its own card: type icon, name, caption, and a circular
 * action. Downloads go through /a/[id] so they're logged. Preview-only files
 * get View instead; expired links can't be opened.
 */
export function AttachmentCard({
  href,
  name,
  kind,
  caption,
  downloadable = true,
  expired = false,
  expiringSoon = false,
  downloaded = false,
  previewUrl,
}: {
  /** Tracked download URL (/a/[id]); omit for static samples. */
  href?: string;
  name: string;
  kind: FileKind;
  /** e.g. "24 MB" or "Expires 12 Oct". */
  caption: string;
  downloadable?: boolean;
  expired?: boolean;
  expiringSoon?: boolean;
  downloaded?: boolean;
  previewUrl?: string | null;
}) {
  const { icon: Icon, className, label } = kindStyles[kind];
  const circle = "flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {previewUrl && (
        <a href={href ? `${href}?view=1` : undefined} target="_blank" rel="noreferrer" className="block bg-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not worth optimising */}
          <img src={previewUrl} alt={name} className="max-h-80 w-full object-contain" />
        </a>
      )}
      <div className="flex items-center gap-3 p-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", expired ? "bg-subtle text-faint" : className)}>
          {expired ? <TimerOff className="size-5" strokeWidth={1.8} /> : <Icon className="size-5" strokeWidth={1.8} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium", expired ? "text-muted" : "text-ink")}>{name}</p>
          <p className="truncate text-xs text-muted">
            {label} · <span className={cn(expired && "font-medium text-urgent", expiringSoon && "font-medium text-high")}>{caption}</span>
            {!downloadable && " · Preview only"}
          </p>
        </div>
        {expired ? null : downloadable ? (
          <a
            href={href}
            target={kind === "link" ? "_blank" : undefined}
            rel="noreferrer"
            aria-label={`Download ${name}`}
            title={downloaded ? "You've downloaded this — download again" : "Download"}
            className={cn(
              circle,
              downloaded ? "border-ok/30 bg-ok/10 text-ok" : "border-line text-ink hover:bg-gold hover:border-gold",
            )}
          >
            {downloaded ? <Check className="size-4" strokeWidth={2.4} /> : <Download className="size-4" strokeWidth={1.8} />}
          </a>
        ) : (
          <a href={href ? `${href}?view=1` : undefined} target="_blank" rel="noreferrer" aria-label={`View ${name}`} className={cn(circle, "border-line text-ink hover:bg-subtle")}>
            <Eye className="size-4" strokeWidth={1.8} />
          </a>
        )}
      </div>
    </div>
  );
}
