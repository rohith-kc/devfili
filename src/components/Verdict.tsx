import type { Guide } from "@/lib/schema";
import { tierLabel, rangeLabel, BASIS_LABEL, GATE_LABEL } from "@/lib/format";
import { TIER_EXPLAIN, CUSTOMER_ADMIN_EXPLAIN } from "@/lib/glossary";
import { EvidenceBadge } from "./EvidenceBadge";
import { InfoTip } from "./InfoTip";

const TIER_DOT: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-blue-500",
  3: "bg-amber-500",
  4: "bg-rose-500",
};

const GATE_NAME = { provider: "Provider review", customerAdmin: "Customer admin", endUser: "End user" } as const;

function Stat({
  label,
  value,
  basis,
}: {
  label: string;
  value: string;
  basis: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <dt className="font-mono-label text-[11px] uppercase text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</dd>
      {basis && (
        <span className="font-mono-label mt-2 inline-block rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted">
          {basis}
        </span>
      )}
    </div>
  );
}

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
        <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-3.5 py-1.5 text-background">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${TIER_DOT[verdict.tier ?? 0] ?? "bg-zinc-400"}`} />
          <span className="font-mono-label text-xs font-semibold uppercase">{tierLabel(verdict.tier)}</span>
          {verdict.tier && <InfoTip label={tierLabel(verdict.tier)}>{TIER_EXPLAIN[verdict.tier]}</InfoTip>}
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

      <div className="mt-4 flex items-start gap-2 text-[15px] leading-relaxed text-foreground">
        <span className="flex-1">{verdict.tierReason.text}</span>
        <EvidenceBadge claim={verdict.tierReason} />
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          label="Your time"
          value={rangeLabel(verdict.effort)}
          basis={verdict.effort ? BASIS_LABEL[verdict.effort.basis] : null}
        />
        <Stat
          label="Waiting on the provider"
          value={rangeLabel(verdict.wait)}
          basis={verdict.wait ? BASIS_LABEL[verdict.wait.basis] : null}
        />
      </dl>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(["provider", "customerAdmin", "endUser"] as const).map((gate) => (
          <div key={gate} className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
            <span className="inline-flex items-center gap-1 text-muted">
              {GATE_NAME[gate]}
              {gate === "customerAdmin" && <InfoTip label="Customer admin">{CUSTOMER_ADMIN_EXPLAIN}</InfoTip>}
            </span>
            <span className="font-semibold text-foreground">{GATE_LABEL[verdict.gates[gate]]}</span>
          </div>
        ))}
      </div>

      {verdict.scopeForks.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl bg-accent/[0.06] p-4">
          {verdict.scopeForks.map((fork, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="flex-1">{fork.text}</span>
              <EvidenceBadge claim={fork} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
