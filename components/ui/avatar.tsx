import { cn } from "@/lib/cn";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-12 text-base" };

/** Initials avatar. `tone="gold"` for the regional manager / broadcast identity. */
export function Avatar({
  name,
  size = "md",
  tone = "neutral",
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  tone?: "neutral" | "gold" | "chrome";
  className?: string;
}) {
  const tones = {
    neutral: "bg-subtle text-ink",
    gold: "bg-gold text-ink",
    chrome: "bg-chrome-raised text-white",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        tones[tone],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
