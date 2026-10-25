"use client";

import { useId, useState } from "react";
import type { Claim } from "@/lib/schema";

const LABEL_META: Record<Claim["label"], { text: string; icon: string; className: string }> = {
  tested: { text: "Tested", icon: "✓", className: "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400" },
  sourced: { text: "Sourced", icon: "↗", className: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400" },
  uncertain: { text: "Uncertain", icon: "?", className: "border-dashed border-amber-400 text-amber-700 dark:border-amber-600 dark:text-amber-400" },
};

export function EvidenceBadge({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const meta = LABEL_META[claim.label];

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((v) => !v)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={`font-mono-label focus-ring inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${meta.className}`}
      >
        <span aria-hidden="true">{meta.icon}</span>
        {meta.text}
      </button>
      {open && (
        <div
          id={popoverId}
          role="dialog"
          className="absolute right-0 top-full z-20 mt-1 w-72 max-w-[90vw] rounded-xl border border-border bg-surface p-3 text-sm normal-case shadow-md"
        >
          {claim.sources.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {claim.sources.map((s, i) => (
                <li key={i} className="flex flex-col">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="focus-ring font-medium text-accent hover:underline"
                  >
                    {s.title}
                  </a>
                  <span className="text-xs text-muted">
                    {s.type} · accessed {s.accessedOn}
                    {s.oldSource ? " · old source" : ""} · {s.recheck.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No source cited.</p>
          )}
          {claim.testNote && <p className="mt-2 text-xs text-muted">{claim.testNote}</p>}
          {claim.uncertainReason && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Why uncertain: {claim.uncertainReason}</p>
          )}
        </div>
      )}
    </span>
  );
}
