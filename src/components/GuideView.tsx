import type { ReactNode } from "react";
import type { Claim, Guide } from "@/lib/schema";
import { rangeLabel, GATE_LABEL } from "@/lib/format";
import { CUSTOMER_ADMIN_EXPLAIN, OWNER_EXPLAIN } from "@/lib/glossary";
import { EvidenceBadge } from "./EvidenceBadge";
import { GuideHeader } from "./GuideHeader";
import { InfoTip } from "./InfoTip";
import { OwnerTag } from "./OwnerTag";
import { Verdict } from "./Verdict";

function ClaimLine({ claim }: { claim: Claim }) {
  return (
    <li className="flex items-start gap-2 text-sm text-foreground">
      <span className="flex-1">{claim.text}</span>
      <EvidenceBadge claim={claim} />
    </li>
  );
}

function Section({
  id,
  title,
  titleExtra,
  children,
}: {
  id: string;
  title: string;
  titleExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-32 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 id={`${id}-heading`} className="mb-4 flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
        <span aria-hidden="true" className="h-5 w-1 rounded-full bg-accent" />
        {title}
        {titleExtra}
      </h2>
      {children}
    </section>
  );
}

export function GuideSections({ guide }: { guide: Guide }) {
  return (
    <>
      <Section id="managed-app" title="Do you need your own app?">
        <p className="mb-2 text-sm text-foreground">
          {guide.managedApp.exists === "yes"
            ? "A managed app may already be available — see below."
            : guide.managedApp.exists === "no"
              ? "No managed app is available — you'll need to register your own."
              : "Unclear whether a managed app is available."}
        </p>
        {guide.managedApp.claim && <ul className="flex flex-col gap-2"><ClaimLine claim={guide.managedApp.claim} /></ul>}
        {guide.managedApp.whatYouLose.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-medium text-muted">What you lose with a managed app</h3>
            <ul className="mt-1 flex flex-col gap-2">
              {guide.managedApp.whatYouLose.map((c) => (
                <ClaimLine key={c.id} claim={c} />
              ))}
            </ul>
          </>
        )}
        {guide.managedApp.whenToSwitch.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-medium text-muted">When to switch to your own app</h3>
            <ul className="mt-1 flex flex-col gap-2">
              {guide.managedApp.whenToSwitch.map((c) => (
                <ClaimLine key={c.id} claim={c} />
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section id="how-it-works" title="How it works">
        <ul className="flex flex-col gap-2">
          {[...guide.howItWorks.flow, ...guide.howItWorks.appTypes, ...guide.howItWorks.tokenNotes].map((c) => (
            <ClaimLine key={c.id} claim={c} />
          ))}
        </ul>
      </Section>

      <Section id="scopes" title="Scopes you'll need">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="font-mono-label border-b border-border text-xs uppercase text-muted">
                <th className="py-2 pr-3 font-medium">Scope</th>
                <th className="py-2 pr-3 font-medium">Allows</th>
                <th className="py-2 pr-3 font-medium">Needed for</th>
                <th className="py-2 pr-2 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {guide.scopes.map((s, i) => (
                <tr key={i} className="border-b border-border/60 align-top last:border-0">
                  <td className="font-mono-label py-2 pr-3 text-xs text-foreground">{s.scope}</td>
                  <td className="py-2 pr-3 text-muted">{s.allows}</td>
                  <td className="py-2 pr-3 text-muted">{s.neededFor}</td>
                  <td className="py-2 pr-2">
                    <EvidenceBadge claim={s.claim} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="prerequisites" title="Before you start">
        <ul className="flex flex-col gap-2">
          {guide.prerequisites.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="flex-1">{p.item}</span>
              <EvidenceBadge claim={p.claim} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="steps" title="Steps">
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted">
          {(["agent_did", "agent_drafted", "you_do"] as const).map((owner) => (
            <span key={owner} className="inline-flex items-center gap-1">
              <OwnerTag owner={owner} />
              <InfoTip label={owner}>{OWNER_EXPLAIN[owner]}</InfoTip>
            </span>
          ))}
        </div>
        <ol className="flex flex-col gap-4">
          {guide.steps.map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="font-mono-label mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                {step.n}
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">{step.title}</h3>
                  <OwnerTag owner={step.owner} />
                  {step.effort && (
                    <span className="text-xs text-muted">{rangeLabel(step.effort)}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{step.detail}</p>
                {step.linkUrl && (
                  <a
                    href={step.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="focus-ring mt-1 inline-block text-xs text-accent hover:underline"
                  >
                    {new URL(step.linkUrl).hostname}
                  </a>
                )}
                {step.helper && (
                  <a href={`#helper-${step.helper}`} className="focus-ring mt-1 block text-xs text-accent hover:underline">
                    {step.owner === "agent_drafted" ? "Draft this in the sidebar →" : "Open the checklist →"}
                  </a>
                )}
                {step.claims.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {step.claims.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-xs text-muted">
                        <span className="flex-1">{c.text}</span>
                        <EvidenceBadge claim={c} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {(["provider", "customerAdmin", "endUser"] as const).map((key) => {
        const gate = guide.gates[key];
        const title = key === "provider" ? "Gate: provider review" : key === "customerAdmin" ? "Gate: customer admin" : "Gate: end user";
        return (
          <Section
            key={key}
            id={`gate-${key}`}
            title={title}
            titleExtra={key === "customerAdmin" ? <InfoTip label="Customer admin">{CUSTOMER_ADMIN_EXPLAIN}</InfoTip> : undefined}
          >
            <p className="mb-1 text-sm text-foreground">
              Applies: <span className="font-medium">{GATE_LABEL[gate.applies]}</span>
            </p>
            {gate.who && <p className="text-sm text-muted">Who: {gate.who}</p>}
            {gate.what && <p className="text-sm text-muted">What: {gate.what}</p>}
            {gate.claims.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2">
                {gate.claims.map((c) => (
                  <ClaimLine key={c.id} claim={c} />
                ))}
              </ul>
            )}
          </Section>
        );
      })}

      <Section id="stuck-points" title="Where it gets stuck">
        <ul className="flex flex-col gap-4">
          {guide.stuckPoints.map((sp, i) => (
            <li key={i}>
              <div className="flex items-start gap-2 text-sm font-medium text-foreground">
                <span className="flex-1">{sp.reason}</span>
                <EvidenceBadge claim={sp.claim} />
              </div>
              <p className="mt-1 text-sm text-muted">{sp.fix}</p>
              {sp.escalation && <p className="mt-1 text-xs text-muted">Escalate: {sp.escalation}</p>}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="good-to-know" title="Good to know">
        {[...guide.whileYouWait, ...guide.keepsComingBack, ...guide.hardToUndo].length === 0 ? (
          <p className="text-sm text-muted">Nothing recurring or hard-to-undo turned up in the research for this one.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...guide.whileYouWait, ...guide.keepsComingBack, ...guide.hardToUndo].map((c) => (
              <ClaimLine key={c.id} claim={c} />
            ))}
          </ul>
        )}
      </Section>

      <Section id="sources" title="Sources">
        <ul className="flex flex-col gap-1.5">
          {guide.derived.sources.map((s, i) => (
            <li key={i} className="text-sm">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="focus-ring text-accent hover:underline"
              >
                {s.title}
              </a>
              <span className="ml-1 text-xs text-muted">({new URL(s.url).hostname})</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

export function GuideView({ guide, hideSave = false }: { guide: Guide; hideSave?: boolean }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5 px-6 pb-20">
      <GuideHeader guide={guide} hideSave={hideSave} />
      <Verdict guide={guide} />
      <GuideSections guide={guide} />
    </article>
  );
}
