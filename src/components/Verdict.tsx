import type { Guide } from "@/lib/schema";
import { tierLabel, rangeLabel, BASIS_LABEL, GATE_LABEL } from "@/lib/format";
import { EvidenceBadge } from "./EvidenceBadge";

export function Verdict({ guide }: { guide: Guide }) {
  const { verdict, completeness } = guide;

  return (
    <section
      aria-labelledby="verdict-heading"
      className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 id="verdict-heading" className="sr-only">
        Verdict
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono-label rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold uppercase text-accent">
          {tierLabel(verdict.tier)}
        </span>
        <span className="text-sm text-muted">
          Confidence: <span className="font-medium text-foreground">{verdict.confidence}</span>
        </span>
        {completeness.status === "incomplete" && (
          <span className="rounded-full border border-dashed border-amber-400 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-600 dark:text-amber-400">
            Incomplete: {completeness.thinSections.join(", ")}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 text-sm text-foreground">
        <span className="flex-1">{verdict.tierReason.text}</span>
        <EvidenceBadge claim={verdict.tierReason} />
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="font-mono-label text-xs uppercase text-muted">Your time</dt>
          <dd className="text-lg font-semibold text-foreground">
            {rangeLabel(verdict.effort)}
            {verdict.effort && (
              <span className="font-mono-label ml-2 rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted">
                {BASIS_LABEL[verdict.effort.basis]}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono-label text-xs uppercase text-muted">Waiting on the provider</dt>
          <dd className="text-lg font-semibold text-foreground">
            {rangeLabel(verdict.wait)}
            {verdict.wait && (
              <span className="font-mono-label ml-2 rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted">
                {BASIS_LABEL[verdict.wait.basis]}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4 text-sm">
        {(["provider", "customerAdmin", "endUser"] as const).map((gate) => (
          <span key={gate} className="text-muted">
            {gate === "provider" ? "Provider review" : gate === "customerAdmin" ? "Customer admin" : "End user"}:{" "}
            <span className="font-medium text-foreground">{GATE_LABEL[verdict.gates[gate]]}</span>
          </span>
        ))}
      </div>

      {verdict.scopeForks.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          {verdict.scopeForks.map((fork, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted">
              <span className="flex-1">{fork.text}</span>
              <EvidenceBadge claim={fork} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
