// Mirrors the `priority` enum in the database. Order matters: the feed sorts
// by `rank` ascending, then recency.
export const PRIORITIES = ["urgent", "high", "normal", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<Priority, { label: string; rank: number; description: string }> = {
  urgent: { label: "Urgent", rank: 0, description: "Push now, escalate by email if unseen" },
  high: { label: "High", rank: 1, description: "Push notification" },
  normal: { label: "Normal", rank: 2, description: "Push notification" },
  low: { label: "Low", rank: 3, description: "Feed only, no push" },
};
