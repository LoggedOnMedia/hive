import { Download, Eye, FileText, Image as ImageIcon, Send } from "lucide-react";
import { cn } from "@/lib/cn";

type Kind = "pdf" | "image" | "other";

const kindStyles: Record<Kind, { icon: typeof FileText; className: string }> = {
  pdf: { icon: FileText, className: "bg-urgent-tint text-urgent" },
  image: { icon: ImageIcon, className: "bg-gold-tint text-high" },
  other: { icon: FileText, className: "bg-subtle text-muted" },
};

/**
 * A file attachment rendered as its own card: type icon, name, type/size
 * caption, and circular actions. `downloadable={false}` is preview-only —
 * no Download/Forward.
 */
export function AttachmentCard({
  filename,
  kind,
  sizeLabel,
  downloadable = true,
}: {
  filename: string;
  kind: Kind;
  sizeLabel: string;
  downloadable?: boolean;
}) {
  const { icon: Icon, className } = kindStyles[kind];
  const circle =
    "flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink hover:bg-subtle";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", className)}>
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{filename}</p>
        <p className="text-xs text-muted">
          {kind === "other" ? "File" : kind.toUpperCase()} · {sizeLabel}
          {!downloadable && " · Preview only"}
        </p>
      </div>
      {downloadable ? (
        <div className="flex gap-2">
          <button className={circle} aria-label={`Forward ${filename}`}>
            <Send className="size-4" strokeWidth={1.8} />
          </button>
          <button className={circle} aria-label={`Download ${filename}`}>
            <Download className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      ) : (
        <button className={circle} aria-label={`View ${filename}`}>
          <Eye className="size-4" strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
