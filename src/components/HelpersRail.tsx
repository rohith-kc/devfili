import type { Guide } from "@/lib/schema";
import { TickList } from "./TickList";
import { HelperPanel } from "./HelperPanel";

export function HelpersRail({ guide }: { guide: Guide }) {
  const prereqItems = guide.prerequisites.map((p) => p.item);
  const submissionItems = guide.steps.filter((s) => s.owner === "you_do").map((s) => s.title);
  const adminDisabled = guide.gates.customerAdmin.applies === "no" ? "This guide's provider gate doesn't need a customer admin, so there's nothing to ask one to approve." : undefined;

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
      <div id="helper-checklist" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Checklist</h2>
        <TickList title="Before you start" items={prereqItems} />
      </div>
      <div id="helper-pre_submission" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Pre-submission check</h2>
        <TickList title="Before you submit" items={submissionItems} />
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Drafted for you</h2>
        <p className="mb-3 text-xs text-muted">
          Fill in a couple of details and we&apos;ll write a first draft from this guide&apos;s own facts &mdash; always
          marked as a draft to review, never sent on your behalf.
        </p>
        <div className="flex flex-col gap-3">
          <HelperPanel
            id="helper-scope_justification"
            helper="scope_justification"
            guide={guide}
            title="Scope justification"
            description="Reviewer-facing notes on why you need each scope."
            fields={[{ key: "product", label: "What does your app do?", placeholder: "e.g. syncs support tickets into our dashboard" }]}
          />
          <HelperPanel
            id="helper-test_plan"
            helper="test_plan"
            guide={guide}
            title="Reviewer test plan"
            description="Numbered steps so a reviewer can exercise your app."
            fields={[
              { key: "signup", label: "How does a reviewer sign up / get access?", placeholder: "e.g. click Sign in, OAuth redirect" },
              { key: "flow", label: "What's the main flow to test?", placeholder: "e.g. connect account, sync 10 records, disconnect" },
            ]}
          />
          <HelperPanel
            id="helper-admin_note"
            helper="admin_note"
            guide={guide}
            title="Customer admin note"
            description="A short message asking a customer's admin to approve the app."
            fields={[
              { key: "appName", label: "Your app's name", placeholder: "e.g. Acme Sync" },
              { key: "company", label: "Customer's company", placeholder: "e.g. Example Corp" },
            ]}
            disabledReason={adminDisabled}
          />
        </div>
      </div>
    </aside>
  );
}
