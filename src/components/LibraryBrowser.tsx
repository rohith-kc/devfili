"use client";

import { useMemo, useState } from "react";
import type { AppMeta } from "@/lib/content";
import type { Guide } from "@/lib/schema";
import { TIER_LABEL } from "@/lib/format";
import { AppTile } from "./AppTile";

type TierFilter = "all" | 1 | 2 | 3 | 4;

export function LibraryBrowser({ items }: { items: { app: AppMeta; guide: Guide }[] }) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<TierFilter>("all");
  const [gatedOnly, setGatedOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(({ app, guide }) => {
      if (q && !app.name.toLowerCase().includes(q) && !app.aliases.some((a) => a.toLowerCase().includes(q))) return false;
      if (tier !== "all" && guide.tile.tier !== tier) return false;
      if (gatedOnly && !guide.tile.gated) return false;
      return true;
    });
  }, [items, query, tier, gatedOnly]);

  return (
    <section id="library" className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Reviewed guides</h2>
          <p className="mt-1 text-sm text-muted">9 apps, hand-reviewed or source-checked.</p>
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search apps</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          >
            <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an app&hellip;"
            className="focus-ring w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted"
          />
        </label>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="font-mono-label mr-1 text-xs uppercase text-muted">Filter</span>
        <button
          type="button"
          onClick={() => setTier("all")}
          className={`focus-ring rounded-full border px-3 py-1 text-xs font-medium ${
            tier === "all" ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
          }`}
        >
          All tiers
        </button>
        {([1, 2, 3, 4] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(tier === t ? "all" : t)}
            className={`focus-ring rounded-full border px-3 py-1 text-xs font-medium ${
              tier === t ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {TIER_LABEL[t]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setGatedOnly((v) => !v)}
          className={`focus-ring rounded-full border px-3 py-1 text-xs font-medium ${
            gatedOnly ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" : "border-border text-muted hover:text-foreground"
          }`}
        >
          Gated only
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
          No reviewed guide matches these filters &mdash; try clearing them, or use &ldquo;Check an app&rdquo; above to
          research any other OAuth app live.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ app, guide }) => (
            <AppTile key={app.slug} app={app} guide={guide} />
          ))}
        </div>
      )}
    </section>
  );
}
