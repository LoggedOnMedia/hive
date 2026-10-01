import { Fragment } from "react";

// Renders WhatsApp's formatting as React elements (no HTML injection):
// *bold*  _italic_  ~strike~  ```monospace```

const RULES: { re: RegExp; wrap: (s: React.ReactNode, k: number) => React.ReactNode }[] = [
  { re: /```([\s\S]+?)```/, wrap: (s, k) => <code key={k} className="rounded bg-black/5 px-1 font-mono text-[0.92em]">{s}</code> },
  { re: /\*([^*\n]+)\*/, wrap: (s, k) => <strong key={k}>{s}</strong> },
  { re: /_([^_\n]+)_/, wrap: (s, k) => <em key={k}>{s}</em> },
  { re: /~([^~\n]+)~/, wrap: (s, k) => <s key={k}>{s}</s> },
];

function format(text: string, key: { n: number }): React.ReactNode[] {
  // Find the earliest match of any rule, render around it, recurse inside.
  let best: { index: number; length: number; inner: string; rule: (typeof RULES)[number] } | null = null;
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { index: m.index, length: m[0].length, inner: m[1], rule };
  }
  if (!best) return [text];
  return [
    text.slice(0, best.index),
    best.rule.wrap(best.rule === RULES[0] ? best.inner : format(best.inner, key), key.n++),
    ...format(text.slice(best.index + best.length), key),
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
