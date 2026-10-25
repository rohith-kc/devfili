"use client";

import { useState } from "react";

export function TickList({ title, items }: { title: string; items: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const [copied, setCopied] = useState(false);
  const remaining = checked.filter((c) => !c).length;

  function toggle(i: number) {
    setChecked((prev) => prev.map((c, j) => (i === j ? !c : c)));
  }

  async function copyAsText() {
    const text = items.map((item, i) => `${checked[i] ? "[x]" : "[ ]"} ${item}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable - no-op
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">Nothing to check off for this guide.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono-label text-xs uppercase text-muted">
          {remaining === 0 ? "All done" : `${remaining} remaining`}
        </span>
        <button type="button" onClick={copyAsText} className="focus-ring font-mono-label text-xs uppercase text-accent hover:underline">
          {copied ? "Copied" : "Copy as text"}
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="focus-ring mt-0.5 h-4 w-4 rounded border-border accent-[var(--color-accent)]"
              />
              <span className={checked[i] ? "text-muted line-through" : "text-foreground"}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <span className="sr-only" aria-live="polite">
        {title}: {remaining} of {items.length} remaining
      </span>
    </div>
  );
}
