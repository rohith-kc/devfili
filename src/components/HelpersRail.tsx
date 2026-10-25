import type { Guide } from "@/lib/schema";
import { TickList } from "./TickList";

export function HelpersRail({ guide }: { guide: Guide }) {
  const prereqItems = guide.prerequisites.map((p) => p.item);
  const submissionItems = guide.steps.filter((s) => s.owner === "you_do").map((s) => s.title);

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Checklist</h2>
        <TickList title="Before you start" items={prereqItems} />
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Pre-submission check</h2>
        <TickList title="Before you submit" items={submissionItems} />
      </div>
      <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted">
        Scope justification, a reviewer test plan, and a customer-admin note are drafted for you once sign-in and the
        AI helpers ship.
      </div>
    </aside>
  );
}
