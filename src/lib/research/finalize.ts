import { applyCheckResult, labelClaim } from "../evidence";
import { computeTier, customerAdminGateState, gatedAccess, type LabeledFact } from "../tier";
import { computeConfidence } from "../confidence";
import { computeCompleteness } from "../completeness";
import { computeBasis, computeEffortRange, computeWaitRange } from "../ranges";
import {
  Guide,
  type Claim,
  type Checked,
  type CheckResult,
  type DClaim,
  type DraftCore,
  type DraftPath,
  type Finding,
  type Gate,
  type GateState,
  type Probe,
  type Source,
  type Step,
} from "../schema";

export interface FinalizeInput {
  app: { name: string; slug: string; websiteUrl: string | null };
  kind: "library" | "live";
  today: string;
  core: DraftCore;
  path: DraftPath;
  findings: Finding[];
  probes: Probe[];
  checkResults?: CheckResult[];
}

interface Ctx {
  findings: Finding[];
  probes: Probe[];
  today: string;
  checkByClaimId: Map<string, CheckResult>;
  allClaims: Claim[];
  nextId: () => string;
}

function makeCtx(input: FinalizeInput): Ctx {
  let counter = 0;
  return {
    findings: input.findings,
    probes: input.probes,
    today: input.today,
    checkByClaimId: new Map((input.checkResults ?? []).map((r) => [r.claimId, r])),
    allClaims: [],
    nextId: () => `c${++counter}`,
  };
}

function deriveChecked(check: CheckResult | undefined): Checked {
  if (!check) return "unchecked";
  if (check.verdict === "supported") return "supported";
  if (check.verdict === "partial") return "partial";
  return "unchecked"; // unsupported or conflict: label already becomes uncertain
}

function buildClaim(dclaim: DClaim, ctx: Ctx, opts: { neverTested?: boolean } = {}): Claim {
  const id = ctx.nextId();
  const labeled = labelClaim(dclaim, ctx.findings, ctx.probes, ctx.today, opts);
  const check = ctx.checkByClaimId.get(id);
  const applied = applyCheckResult(labeled, check);
  const claim: Claim = {
    id,
    text: dclaim.text,
    label: applied.label,
    sources: applied.sources,
    testNote: applied.testNote,
    uncertainReason: applied.uncertainReason,
    checked: deriveChecked(check),
  };
  ctx.allClaims.push(claim);
  return claim;
}

function buildLabeledFact(fact: DraftCore["facts"]["partnerGated"], ctx: Ctx): LabeledFact {
  return { value: fact.value, claim: fact.claim ? buildClaim(fact.claim, ctx) : null };
}

function resolveLinkUrl(linkFindingId: string | null, findings: Finding[]): string | null {
  if (!linkFindingId) return null;
  return findings.find((f) => f.id === linkFindingId)?.sourceUrl ?? null;
}

function buildGate(dgate: DraftPath["gates"]["provider"], ctx: Ctx, appliesOverride?: GateState): Gate {
  return {
    applies: appliesOverride ?? dgate.applies,
    who: dgate.who,
    what: dgate.what,
    claims: dgate.claims.map((c) => buildClaim(c, ctx)),
  };
}

function dedupeSources(claims: Claim[]): Source[] {
  const seen = new Map<string, Source>();
  for (const claim of claims) {
    for (const source of claim.sources) {
      if (!seen.has(source.url)) seen.set(source.url, source);
    }
  }
  return [...seen.values()];
}

/** Assembles the full persisted Guide from a DraftCore + DraftPath + the
 * findings/probes that backed them (and, on the second pass, the check
 * stage's results). Every label, the tier, both ranges, confidence and
 * completeness are computed here - never written by a model. */
export function finalizeGuide(input: FinalizeInput): Guide {
  const ctx = makeCtx(input);
  const { core, path } = input;

  const partnerGated = buildLabeledFact(core.facts.partnerGated, ctx);
  const securityAssessment = buildLabeledFact(core.facts.securityAssessment, ctx);
  const reviewRequired = buildLabeledFact(core.facts.reviewRequired, ctx);
  const customerAdminLikely = buildLabeledFact(core.facts.customerAdminLikely, ctx);
  buildLabeledFact(core.facts.userCapBeforeApproval, ctx); // informs whileYouWait prose only

  const { tier } = computeTier({ partnerGated, securityAssessment, reviewRequired });
  const tierReason = buildClaim(core.tierReason, ctx);

  const waitClaim = core.wait ? buildClaim(core.wait.claim, ctx, { neverTested: true }) : null;
  const wait = core.wait && waitClaim ? computeWaitRange({ ...core.wait, claim: waitClaim }) : null;

  const scopeForks = core.scopeForks.map((c) => buildClaim(c, ctx));

  const managedAppClaim = core.managedApp.claim ? buildClaim(core.managedApp.claim, ctx) : null;
  const managedApp = {
    exists: core.managedApp.exists,
    claim: managedAppClaim,
    whatYouLose: core.managedApp.whatYouLose.map((c) => buildClaim(c, ctx)),
    whenToSwitch: core.managedApp.whenToSwitch.map((c) => buildClaim(c, ctx)),
  };

  const howItWorks = {
    flow: core.howItWorks.flow.map((c) => buildClaim(c, ctx)),
    appTypes: core.howItWorks.appTypes.map((c) => buildClaim(c, ctx)),
    tokenNotes: core.howItWorks.tokenNotes.map((c) => buildClaim(c, ctx)),
  };

  const scopes = core.scopes.map((s) => ({
    scope: s.scope,
    allows: s.allows,
    neededFor: s.neededFor,
    reviewImpact: s.reviewImpact,
    claim: buildClaim(s.claim, ctx),
  }));

  const prerequisites = core.prerequisites.map((p) => ({
    item: p.item,
    kind: p.kind,
    claim: buildClaim(p.claim, ctx),
  }));

  const steps: Step[] = path.steps.map((s, i) => {
    const claims = s.claims.map((c) => buildClaim(c, ctx));
    const effort = s.effortHours
      ? {
          min: s.effortHours.min,
          max: s.effortHours.max,
          unit: "hours" as const,
          basis: computeBasis(claims[0] ?? null),
          claimId: claims[0]?.id ?? null,
        }
      : null;
    return {
      n: i + 1,
      title: s.title,
      detail: s.detail,
      owner: s.owner,
      effort,
      linkUrl: resolveLinkUrl(s.linkFindingId, input.findings),
      helper: s.helper,
      claims,
    };
  });

  const customerAdminGate = buildGate(path.gates.customerAdmin, ctx, customerAdminGateState(customerAdminLikely.value));
  const gates = {
    provider: buildGate(path.gates.provider, ctx),
    customerAdmin: customerAdminGate,
    endUser: buildGate(path.gates.endUser, ctx),
  };

  const stuckPoints = path.stuckPoints.map((sp) => ({
    reason: sp.reason,
    fix: sp.fix,
    escalation: sp.escalation,
    claim: buildClaim(sp.claim, ctx),
  }));

  const whileYouWait = path.whileYouWait.map((c) => buildClaim(c, ctx));
  const keepsComingBack = path.keepsComingBack.map((c) => buildClaim(c, ctx));
  const hardToUndo = path.hardToUndo.map((c) => buildClaim(c, ctx));

  const effort = computeEffortRange(steps);
  const confidence = computeConfidence({
    tier,
    tierFactClaims: [partnerGated.claim, securityAssessment.claim, reviewRequired.claim],
    wait,
    sources: dedupeSources(ctx.allClaims),
  });

  const completeness = computeCompleteness({ tier, scopes, prerequisites, steps, gates, stuckPoints });

  const verdictGates = { provider: gates.provider.applies, customerAdmin: gates.customerAdmin.applies, endUser: gates.endUser.applies };

  const guide: Guide = {
    schemaVersion: 1,
    app: input.app,
    kind: input.kind,
    sample: false,
    lastVerifiedOn: input.today,
    handVerified: null,
    completeness,
    verdict: {
      tier,
      tierReason,
      effort,
      wait,
      gates: verdictGates,
      gatedAccess: gatedAccess(tier),
      confidence,
      scopeForks,
    },
    managedApp,
    howItWorks,
    scopes,
    prerequisites,
    steps,
    gates,
    stuckPoints,
    whileYouWait,
    keepsComingBack,
    hardToUndo,
    derived: {
      unverifiedClaimIds: ctx.allClaims.filter((c) => c.label === "uncertain").map((c) => c.id),
      sources: dedupeSources(ctx.allClaims),
    },
    tile: { tier, effort, wait, gated: gatedAccess(tier), customerAdmin: gates.customerAdmin.applies },
  };

  return Guide.parse(guide);
}

/** Every claim this pass produced, keyed by id, with the URLs and excerpts
 * the check stage needs. Call this on the pre-check finalize pass to build
 * the check stage's input list. */
export function claimsForCheck(guide: Guide, findings: Finding[]): { claimId: string; text: string; urls: string[]; excerpts: string[] }[] {
  const excerptByUrl = new Map(findings.map((f) => [f.sourceUrl, f.excerpt]));
  const seen = new Set<string>();
  const out: { claimId: string; text: string; urls: string[]; excerpts: string[] }[] = [];

  function visit(claim: Claim) {
    if (seen.has(claim.id)) return;
    seen.add(claim.id);
    if (claim.label === "tested" || claim.sources.length === 0) return; // nothing to independently check
    out.push({
      claimId: claim.id,
      text: claim.text,
      urls: claim.sources.map((s) => s.url),
      excerpts: claim.sources.map((s) => excerptByUrl.get(s.url) ?? "").filter(Boolean),
    });
  }

  visit(guide.verdict.tierReason);
  guide.verdict.scopeForks.forEach(visit);
  if (guide.managedApp.claim) visit(guide.managedApp.claim);
  guide.managedApp.whatYouLose.forEach(visit);
  guide.managedApp.whenToSwitch.forEach(visit);
  guide.howItWorks.flow.forEach(visit);
  guide.howItWorks.appTypes.forEach(visit);
  guide.howItWorks.tokenNotes.forEach(visit);
  guide.scopes.forEach((s) => visit(s.claim));
  guide.prerequisites.forEach((p) => visit(p.claim));
  guide.steps.forEach((s) => s.claims.forEach(visit));
  guide.gates.provider.claims.forEach(visit);
  guide.gates.customerAdmin.claims.forEach(visit);
  guide.gates.endUser.claims.forEach(visit);
  guide.stuckPoints.forEach((sp) => visit(sp.claim));
  guide.whileYouWait.forEach(visit);
  guide.keepsComingBack.forEach(visit);
  guide.hardToUndo.forEach(visit);

  // prioritize wait/effort (via claimId), then tier reason, then the rest
  const priorityIds = new Set([guide.verdict.wait?.claimId, guide.verdict.effort?.claimId, guide.verdict.tierReason.id].filter(Boolean));
  out.sort((a, b) => Number(priorityIds.has(b.claimId)) - Number(priorityIds.has(a.claimId)));

  return out;
}
