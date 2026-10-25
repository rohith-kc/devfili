"use client";

import { useEffect, useState } from "react";
import type { Guide } from "@/lib/schema";
import { TickList } from "./TickList";
import { HelperPanel } from "./HelperPanel";

type Tab = "checklist" | "submit" | "drafts";

function tabForHash(hash: string): Tab | null {
  if (hash === "#helper-checklist") return "checklist";
  if (hash === "#helper-pre_submission") return "submit";
  if (hash.startsWith("#helper-")) return "drafts";
  return null;
}

export function HelpersRail({ guide }: { guide: Guide }) {
  const [tab, setTab] = useState<Tab>("checklist");
  const prereqItems = guide.prerequisites.map((p) => p.item);
  const submissionItems = guide.steps.filter((s) => s.owner === "you_do").map((s) => s.title);
  const adminDisabled =
    guide.gates.customerAdmin.applies === "no"
      ? "This guide's provider gate doesn't need a customer admin, so there's nothing to ask one to approve."
      : undefined;

  // A step link jumps to a helper anchor; switch to the tab that holds it,
  // then scroll once it is visible.
  useEffect(() => {
    function onHashChange() {
      const next = tabForHash(window.location.hash);
      if (!next) return;
      setTab(next);
      setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 0);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "checklist", label: "Checklist", count: prereqItems.length },
    { id: "submit", label: "Before submit", count: submissionItems.length },
    { id: "drafts", label: "Drafts" },
  ];

  return (
    <aside
      aria-label="Toolkit"
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]"
    >
      <div className="border-b border-border p-4 pb-0">
        <p className="font-mono-label text-[11px] uppercase text-muted">Toolkit</p>
        <div role="tablist" aria-label="Toolkit sections" className="mt-2 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`focus-ring -mb-px flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab === t.id ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="font-mono-label rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto p-4">
        <div id="panel-checklist" role="tabpanel" aria-labelledby="tab-checklist" hidden={tab !== "checklist"}>
          <div id="helper-checklist" className="scroll-mt-24">
            <TickList title="Before you start" items={prereqItems} />
          </div>
        </div>
        <div id="panel-submit" role="tabpanel" aria-labelledby="tab-submit" hidden={tab !== "submit"}>
          <div id="helper-pre_submission" className="scroll-mt-24">
            <TickList title="Before you submit" items={submissionItems} />
          </div>
        </div>
        <div id="panel-drafts" role="tabpanel" aria-labelledby="tab-drafts" hidden={tab !== "drafts"}>
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
      </div>
    </aside>
  );
}
