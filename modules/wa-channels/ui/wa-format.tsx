import { Fragment } from "react";

// Renders WhatsApp's formatting as React elements (no HTML injection), using
// WhatsApp's own rules so the preview never shows bold where WhatsApp won't:
//   *bold*  _italic_  ~strike~  ```monospace```
// A marker only counts when the text inside starts and ends with a non-space
// character, the opening marker is at the start or after a space/punctuation,
// and the closing marker is at the end or before a space/punctuation.
// "For* Grove*" is therefore NOT bold — in WhatsApp or here.

const BEFORE = String.raw`(^|[\s([{"'])`;
const AFTER = String.raw`(?=$|[\s.,!?;:)\]}"'])`;
const inline = (m: string) => new RegExp(`${BEFORE}\\${m}(\\S(?:[^${m}\\n]*?\\S)?)\\${m}${AFTER}`);

const RULES: { re: RegExp; code?: boolean; wrap: (s: React.ReactNode, k: number) => React.ReactNode }[] = [
  {
    re: /()```([\s\S]+?)```/,
    code: true,
    wrap: (s, k) => (
      <code key={k} className="rounded bg-black/5 px-1 font-mono text-[0.92em]">
        {s}
      </code>
    ),
  },
  { re: inline("*"), wrap: (s, k) => <strong key={k}>{s}</strong> },
  { re: inline("_"), wrap: (s, k) => <em key={k}>{s}</em> },
  { re: inline("~"), wrap: (s, k) => <s key={k}>{s}</s> },
];

function format(text: string, key: { n: number }): React.ReactNode[] {
  // Find the earliest match of any rule, render around it, recurse inside.
  let best: { start: number; end: number; inner: string; rule: (typeof RULES)[number] } | null = null;
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const start = m.index + m[1].length; // skip the space/punctuation before the marker
    if (best === null || start < best.start) best = { start, end: m.index + m[0].length, inner: m[2], rule };
  }
  if (!best) return [text];
  return [
    text.slice(0, best.start),
    best.rule.wrap(best.rule.code ? best.inner : format(best.inner, key), key.n++),
    ...format(text.slice(best.end), key),
  ];
}

export function WhatsAppText({ text }: { text: string }) {
  const key = { n: 0 };
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {format(line, key)}
        </Fragment>
      ))}
    </>
  );
}
