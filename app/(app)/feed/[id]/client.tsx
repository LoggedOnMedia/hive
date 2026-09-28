"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CornerDownRight, SendHorizontal, Trash2, X } from "lucide-react";
import { deletePost, markSeen, replyToPost } from "@/app/actions/posts";
import type { FormState } from "@/app/actions/stores";
import { EmojiPicker, ReactionBar } from "@/components/feed/emoji";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/lib/cn";
import type { ReactionMap, ThreadMessage } from "@/lib/posts";

/** Records the open once, after the page has actually rendered for the user. */
export function MarkSeen({ postId }: { postId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markSeen(postId);
  }, [postId]);
  return null;
}

export function ReplyForm({
  postId,
  storeId,
  parentId,
  placeholder,
  autoFocus,
  onSent,
}: {
  postId: string;
  storeId?: string;
  parentId?: string;
  placeholder: string;
  autoFocus?: boolean;
  onSent?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await replyToPost(postId, prev, fd);
    if (result.ok) {
      formRef.current?.reset();
      onSent?.();
      return {};
    }
    return result;
  }, {});

  // Insert at the cursor rather than appending, so emojis land where you're typing.
  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.setRangeText(emoji, start, end, "end");
    el.focus();
  };

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      {storeId && <input type="hidden" name="store_id" value={storeId} />}
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <div className="flex items-end gap-1 rounded-2xl border border-line bg-surface p-1.5 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/40">
        <EmojiPicker onPick={insertEmoji} />
        <textarea
          ref={inputRef}
          name="body"
          rows={1}
          required
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-ink placeholder:text-faint focus:outline-none field-sizing-content"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Send reply"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink hover:bg-gold-strong disabled:opacity-50"
        >
          <SendHorizontal className="size-4" strokeWidth={2} />
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

function Bubble({ m, compact = false }: { m: ThreadMessage; compact?: boolean }) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-2xl rounded-tl-md border",
        compact ? "px-3.5 py-2.5" : "px-4 py-3",
        m.authorIsRM ? "border-gold-line bg-gold-tint" : "border-line bg-surface",
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span className="font-semibold text-ink">{m.authorIsRM ? m.authorName : m.storeName}</span>
        <span className="text-muted">· {m.authorIsRM ? "Regional Manager" : m.authorName}</span>
        <span className="ml-auto text-faint">{m.timeLabel}</span>
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{m.body}</p>
    </div>
  );
}

const who = (m: ThreadMessage) => (m.authorIsRM ? m.authorName : (m.storeName ?? m.authorName));

/**
 * Replies grouped as top-level messages with their answers nested beneath.
 * Anyone who can see a reply can answer it or react to it.
 */
export function Thread({
  postId,
  messages,
  reactions,
  storeId,
  emptyLabel,
}: {
  postId: string;
  messages: ThreadMessage[];
  reactions: ReactionMap;
  /** Private-replies conversation the regional manager is viewing. */
  storeId?: string;
  emptyLabel: string;
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const tops = messages.filter((m) => !m.parentId);
  const answers = (id: string) => messages.filter((m) => m.parentId === id);

  if (tops.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{emptyLabel}</p>
    );
  }

  const replyButton = (top: ThreadMessage) => (
    <button
      type="button"
      onClick={() => setReplyingTo((r) => (r === top.id ? null : top.id))}
      className="flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted hover:bg-subtle hover:text-ink"
    >
      <CornerDownRight className="size-3.5" /> Reply
    </button>
  );

  return (
    <ul className="flex flex-col gap-5">
      {tops.map((top) => {
        const kids = answers(top.id);
        return (
          <li key={top.id} className="flex gap-3">
            <Avatar name={who(top)} size="sm" tone={top.authorIsRM ? "gold" : "neutral"} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bubble m={top} />
              <ReactionBar postId={postId} target={top.id} reactions={reactions[top.id] ?? []}>
                {replyButton(top)}
              </ReactionBar>

              {kids.length > 0 && (
                <ul className="mt-1 flex flex-col gap-3 border-l-2 border-line pl-3">
                  {kids.map((k) => (
                    <li key={k.id} className="flex gap-2.5">
                      <Avatar name={who(k)} size="sm" tone={k.authorIsRM ? "gold" : "neutral"} className="size-7 text-[11px]" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Bubble m={k} compact />
                        <ReactionBar postId={postId} target={k.id} reactions={reactions[k.id] ?? []}>
                          {replyButton(top)}
                        </ReactionBar>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {replyingTo === top.id && (
                <div className="mt-1 border-l-2 border-gold pl-3">
                  <div className="mb-1.5 flex items-center gap-1 text-xs text-muted">
                    Replying to <span className="font-semibold text-ink">{who(top)}</span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      aria-label="Cancel reply"
                      className="ml-1 rounded-full p-0.5 hover:bg-subtle hover:text-ink"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <ReplyForm
                    postId={postId}
                    storeId={storeId}
                    parentId={top.id}
                    placeholder={`Reply to ${who(top)}…`}
                    autoFocus
                    onSent={() => setReplyingTo(null)}
                  />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DeletePostButton({ postId }: { postId: string }) {
  return (
    <form
      action={deletePost.bind(null, postId)}
      onSubmit={(e) => {
        if (!confirm("Delete this message for every store? Replies and read receipts go with it.")) e.preventDefault();
      }}
    >
      <Button type="submit" variant="danger" size="sm">
        <Trash2 className="size-4" strokeWidth={1.8} />
        Delete
      </Button>
    </form>
  );
}
