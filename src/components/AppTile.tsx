import Link from "next/link";
import type { AppMeta } from "@/lib/content";
import type { Guide } from "@/lib/schema";
import { tierLabel, rangeLabel } from "@/lib/format";

export function AppTile({ app, guide }: { app: AppMeta; guide: Guide }) {
  const { tile } = guide;

  return (
    <Link
      href={`/guide/${app.slug}`}
      className="focus-ring flex flex-col gap-3 rounded border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-accent dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{app.name}</h3>
        {guide.handVerified && (
          <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Hand-verified
          </span>
        )}
      </div>
      <span className="inline-flex w-fit rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {tierLabel(tile.tier as 1 | 2 | 3 | 4 | null)}
      </span>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <dt className="font-medium">Your time</dt>
        <dd>{rangeLabel(tile.effort)}</dd>
        <dt className="font-medium">Wait</dt>
        <dd>{rangeLabel(tile.wait)}</dd>
      </dl>
      <div className="flex flex-wrap gap-1.5">
        {tile.gated && (
          <span className="rounded border border-amber-300 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-700 dark:text-amber-400">
            Gated
          </span>
        )}
        {tile.customerAdmin === "yes" && (
          <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Needs customer admin
          </span>
        )}
      </div>
    </Link>
  );
}
