import type { Guide } from "@/lib/schema";
import { tierLabel, rangeLabel, BASIS_LABEL, GATE_LABEL } from "@/lib/format";
import { EvidenceBadge } from "./EvidenceBadge";

export function Verdict({ guide }: { guide: Guide }) {
  const { verdict, completeness } = guide;

  return (
    <section aria-labelledby="verdict-heading" className="rounded border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 id="verdict-heading" className="sr-only">
        Verdict
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-accent/10 px-2.5 py-1 text-sm font-semibold text-accent">{tierLabel(verdict.tier)}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Confidence: <span className="font-medium text-foreground">{verdict.confidence}</span>
        </span>
        {completeness.status === "incomplete" && (
          <span className="rounded border border-amber-400 border-dashed px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-600 dark:text-amber-400">
            Incomplete: {completeness.thinSections.join(", ")}
          </span>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm text-foreground">
        <span className="flex-1">{verdict.tierReason.text}</span>
        <EvidenceBadge claim={verdict.tierReason} />
      </p>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Your time</dt>
          <dd className="text-lg font-semibold text-foreground">
            {rangeLabel(verdict.effort)}
            {verdict.effort && (
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {BASIS_LABEL[verdict.effort.basis]}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Waiting on the provider</dt>
          <dd className="text-lg font-semibold text-foreground">
            {rangeLabel(verdict.wait)}
            {verdict.wait && (
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {BASIS_LABEL[verdict.wait.basis]}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        {(["provider", "customerAdmin", "endUser"] as const).map((gate) => (
          <span key={gate} className="text-zinc-600 dark:text-zinc-400">
            {gate === "provider" ? "Provider review" : gate === "customerAdmin" ? "Customer admin" : "End user"}:{" "}
            <span className="font-medium text-foreground">{GATE_LABEL[verdict.gates[gate]]}</span>
          </span>
        ))}
      </div>

      {verdict.scopeForks.length > 0 && (
        <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {verdict.scopeForks.map((fork, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="flex-1">{fork.text}</span>
              <EvidenceBadge claim={fork} />
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
