"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POPOVER_WIDTH = 260;

export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left - POPOVER_WIDTH / 2), window.innerWidth - POPOVER_WIDTH - 8);
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
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What does "${label}" mean?`}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none text-muted hover:text-foreground"
      >
        ?
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            id={id}
            role="tooltip"
            style={{ position: "fixed", top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
            className="z-50 rounded-xl border border-border bg-surface p-3 text-xs normal-case leading-relaxed text-foreground shadow-lg"
          >
            {children}
          </div>,
          document.body
        )}
    </span>
  );
}
