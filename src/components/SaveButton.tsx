"use client";

import type { Guide } from "@/lib/schema";
import { removeSavedGuide, saveGuide, useHydrated, useSavedGuides } from "@/lib/localUser";

export function SaveButton({
  guide,
  variant = "pill",
}: {
  guide: Guide;
  variant?: "pill" | "icon";
}) {
  const hydrated = useHydrated();
  const saved = useSavedGuides().some((g) => g.slug === guide.app.slug);
  const isSaved = hydrated && saved;
  const label = isSaved ? "Saved" : "Save for later";

  function toggle() {
    if (isSaved) removeSavedGuide(guide.app.slug);
    else saveGuide(guide);
  }

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </svg>
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isSaved}
        aria-label={`${label}: ${guide.app.name}`}
        title={label}
        className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full border bg-surface transition-colors ${
          isSaved ? "border-accent text-accent" : "border-border text-muted hover:border-accent hover:text-accent"
        }`}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isSaved}
      className={`font-mono-label focus-ring inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase transition-colors ${
        isSaved
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-surface text-foreground hover:border-accent hover:text-accent"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
