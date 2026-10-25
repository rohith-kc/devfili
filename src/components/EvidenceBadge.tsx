"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Claim } from "@/lib/schema";

const LABEL_META: Record<Claim["label"], { text: string; icon: string; className: string }> = {
  tested: {
    text: "Tested",
    icon: "✓",
    className: "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400",
  },
  sourced: {
    text: "Sourced",
    icon: "↗",
    className: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400",
  },
  uncertain: {
    text: "Uncertain",
    icon: "?",
    className: "border-dashed border-amber-400 text-amber-700 dark:border-amber-600 dark:text-amber-400",
  },
};

const LABEL_EXPLAIN: Record<Claim["label"], string> = {
  tested: "We fetched the live page ourselves and confirmed the exact wording this claim relies on.",
  sourced:
    "Cited from an official or credible page, but our automatic re-check couldn't confirm the exact wording (the page may render its content via JavaScript).",
  uncertain: "We couldn't independently confirm this - treat it as a reasonable best read of the docs, not a verified fact.",
};

const POPOVER_WIDTH = 288;

export function EvidenceBadge({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const meta = LABEL_META[claim.label];

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.right - POPOVER_WIDTH), window.innerWidth - POPOVER_WIDTH - 8);
    setCoords({ top: rect.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((v) => !v)}
        className={`font-mono-label focus-ring inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${meta.className}`}
      >
        <span aria-hidden="true">{meta.icon}</span>
        {meta.text}
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            style={{ position: "fixed", top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
            className="z-50 rounded-xl border border-border bg-surface p-3 text-sm normal-case shadow-lg"
          >
            <p className="mb-2 text-xs text-muted">{LABEL_EXPLAIN[claim.label]}</p>
            {claim.sources.length > 0 ? (
              <ul className="flex flex-col gap-2 border-t border-border pt-2">
                {claim.sources.map((s, i) => (
                  <li key={i} className="flex flex-col">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="focus-ring break-words font-medium text-accent underline underline-offset-2 hover:opacity-80"
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
              <p className="border-t border-border pt-2 text-muted">No source cited.</p>
            )}
            {claim.testNote && <p className="mt-2 text-xs text-muted">{claim.testNote}</p>}
            {claim.uncertainReason && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Why uncertain: {claim.uncertainReason}</p>
            )}
          </div>,
          document.body
        )}
    </span>
  );
}
