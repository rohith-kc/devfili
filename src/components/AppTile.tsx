import Link from "next/link";
import type { AppMeta } from "@/lib/content";
import type { Guide } from "@/lib/schema";
import { tierLabel, rangeLabel } from "@/lib/format";
import { AppIcon } from "./AppIcon";

const TIER_DOT: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-blue-500",
  3: "bg-amber-500",
  4: "bg-rose-500",
};

export function AppTile({ app, guide }: { app: AppMeta; guide: Guide }) {
  const { tile } = guide;

  return (
    <Link
      href={`/guide/${app.slug}`}
      className="focus-ring group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <AppIcon slug={app.slug} name={app.name} />
        {guide.handVerified && (
          <span className="font-mono-label shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Hand-verified
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">{app.name}</h3>
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[tile.tier ?? 0] ?? "bg-zinc-400"}`} />
          {tierLabel(tile.tier as 1 | 2 | 3 | 4 | null)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-3 text-sm">
        <dt className="text-muted">Your time</dt>
        <dd className="text-right font-medium text-foreground">{rangeLabel(tile.effort)}</dd>
        <dt className="text-muted">Wait</dt>
        <dd className="text-right font-medium text-foreground">{rangeLabel(tile.wait)}</dd>
      </dl>

      {(tile.gated || tile.customerAdmin === "yes") && (
        <div className="flex flex-wrap gap-1.5">
          {tile.gated && (
            <span className="font-mono-label rounded-full border border-amber-300 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:border-amber-700 dark:text-amber-400">
              Gated
            </span>
          )}
          {tile.customerAdmin === "yes" && (
            <span className="font-mono-label rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase text-muted">
              Customer admin
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
