import { z } from "zod";

// ---- Persisted guide schema. Models never write label, tier, confidence or
// completeness directly - those are always computed by code (tier.ts,
// evidence.ts, confidence.ts, completeness.ts) and assembled in finalize.ts. ----

export const Label = z.enum(["tested", "sourced", "uncertain"]);
export type Label = z.infer<typeof Label>;

export const SourceType = z.enum(["official", "community", "vendor"]);
export type SourceType = z.infer<typeof SourceType>;

export const Recheck = z.enum(["confirmed", "not_rechecked", "mismatch"]);
export type Recheck = z.infer<typeof Recheck>;

export const Source = z.object({
  url: z.string().url(),
  title: z.string(),
  type: SourceType,
  accessedOn: z.string(), // YYYY-MM-DD
  publishedYear: z.number().int().nullable(),
  oldSource: z.boolean(), // community/vendor and older than 2 years
  recheck: Recheck,
});
export type Source = z.infer<typeof Source>;

export const Checked = z.enum(["supported", "partial", "unchecked"]);
export type Checked = z.infer<typeof Checked>;

export const Claim = z.object({
  id: z.string(), // c1, c2, ...
  text: z.string(), // paraphrased, plain, <= 40 words
  label: Label,
  sources: z.array(Source),
  testNote: z.string().nullable(),
  uncertainReason: z.string().nullable(),
  checked: Checked,
});
export type Claim = z.infer<typeof Claim>;

export const RangeUnit = z.enum(["hours", "days", "business_days", "weeks"]);
export type RangeUnit = z.infer<typeof RangeUnit>;

export const RangeBasis = z.enum(["official", "reported", "estimated"]);
export type RangeBasis = z.infer<typeof RangeBasis>;

export const Range = z.object({
  min: z.number(),
  max: z.number(),
  unit: RangeUnit,
  basis: RangeBasis,
  claimId: z.string().nullable(),
});
export type Range = z.infer<typeof Range>;

export const GateState = z.enum(["yes", "no", "unknown"]);
export type GateState = z.infer<typeof GateState>;

export const Gate = z.object({
  applies: GateState,
  who: z.string(),
  what: z.string(),
  claims: z.array(Claim),
});
export type Gate = z.infer<typeof Gate>;

export const StepOwner = z.enum(["agent_did", "agent_drafted", "you_do"]);
export type StepOwner = z.infer<typeof StepOwner>;

export const HelperKind = z.enum(["checklist", "scope_justification", "test_plan", "admin_note", "pre_submission"]);
export type HelperKind = z.infer<typeof HelperKind>;

export const Step = z.object({
  n: z.number().int(),
  title: z.string(),
  detail: z.string(),
  owner: StepOwner,
  effort: Range.nullable(), // only for you_do
  linkUrl: z.string().url().nullable(), // resolved from a finding, never typed by a model
  helper: HelperKind.nullable(),
  claims: z.array(Claim),
});
export type Step = z.infer<typeof Step>;

export const Tier = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type Tier = z.infer<typeof Tier>;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const ReviewImpact = z.enum(["none", "verification", "security_assessment", "partner", "unknown"]);
export type ReviewImpact = z.infer<typeof ReviewImpact>;

export const PrerequisiteKind = z.enum([
  "account",
  "business",
  "domain",
  "policy_page",
  "test_account",
  "demo_video",
  "partner",
  "fee",
  "other",
]);
export type PrerequisiteKind = z.infer<typeof PrerequisiteKind>;

export const Guide = z.object({
  schemaVersion: z.literal(1),
  app: z.object({ name: z.string(), slug: z.string(), websiteUrl: z.string().url().nullable() }),
  kind: z.enum(["library", "live"]),
  sample: z.boolean(), // true only for fixtures
  lastVerifiedOn: z.string(),
  handVerified: z.object({ by: z.string(), on: z.string() }).nullable(),
  completeness: z.object({ status: z.enum(["complete", "incomplete"]), thinSections: z.array(z.string()) }),
  verdict: z.object({
    tier: Tier.nullable(),
    tierReason: Claim,
    effort: Range.nullable(),
    wait: Range.nullable(),
    gates: z.object({ provider: GateState, customerAdmin: GateState, endUser: GateState }),
    gatedAccess: z.boolean(),
    confidence: Confidence,
    scopeForks: z.array(Claim),
  }),
  managedApp: z.object({
    exists: GateState,
    claim: Claim.nullable(),
    whatYouLose: z.array(Claim),
    whenToSwitch: z.array(Claim),
  }),
  howItWorks: z.object({ flow: z.array(Claim), appTypes: z.array(Claim), tokenNotes: z.array(Claim) }),
  scopes: z.array(
    z.object({
      scope: z.string(),
      allows: z.string(),
      neededFor: z.string(),
      reviewImpact: ReviewImpact,
      claim: Claim,
    })
  ),
  prerequisites: z.array(z.object({ item: z.string(), kind: PrerequisiteKind, claim: Claim })),
  steps: z.array(Step),
  gates: z.object({ provider: Gate, customerAdmin: Gate, endUser: Gate }),
  stuckPoints: z.array(
    z.object({ reason: z.string(), fix: z.string(), escalation: z.string().nullable(), claim: Claim })
  ),
  whileYouWait: z.array(Claim),
  keepsComingBack: z.array(Claim),
  hardToUndo: z.array(Claim),
  derived: z.object({ unverifiedClaimIds: z.array(z.string()), sources: z.array(Source) }),
  tile: z.object({
    tier: z.number().nullable(),
    effort: Range.nullable(),
    wait: Range.nullable(),
    gated: z.boolean(),
    customerAdmin: GateState,
  }),
});
export type Guide = z.infer<typeof Guide>;

// ---- LLM-facing draft schemas. Flat, every field required (nullable instead
// of optional), additionalProperties:false shape so Groq strict mode accepts
// them. Models cite ONLY finding/probe ids; they never output URLs, labels,
// tiers or confidence. ----

export const DClaim = z.object({
  text: z.string(),
  findingIds: z.array(z.string()),
  probeIds: z.array(z.string()),
});
export type DClaim = z.infer<typeof DClaim>;

export const Fact = z.object({ value: z.boolean().nullable(), claim: DClaim.nullable() });
export type Fact = z.infer<typeof Fact>;

export const DraftCore = z.object({
  facts: z.object({
    partnerGated: Fact,
    securityAssessment: Fact,
    reviewRequired: Fact,
    customerAdminLikely: Fact,
    userCapBeforeApproval: Fact,
  }),
  tierReason: DClaim,
  wait: z
    .object({ min: z.number(), max: z.number(), unit: RangeUnit, claim: DClaim })
    .nullable(),
  scopeForks: z.array(DClaim),
  managedApp: z.object({
    exists: GateState,
    claim: DClaim.nullable(),
    whatYouLose: z.array(DClaim),
    whenToSwitch: z.array(DClaim),
  }),
  howItWorks: z.object({ flow: z.array(DClaim), appTypes: z.array(DClaim), tokenNotes: z.array(DClaim) }),
  scopes: z.array(
    z.object({ scope: z.string(), allows: z.string(), neededFor: z.string(), reviewImpact: ReviewImpact, claim: DClaim })
  ),
  prerequisites: z.array(z.object({ item: z.string(), kind: PrerequisiteKind, claim: DClaim })),
});
export type DraftCore = z.infer<typeof DraftCore>;

export const DGate = z.object({ applies: GateState, who: z.string(), what: z.string(), claims: z.array(DClaim) });
export type DGate = z.infer<typeof DGate>;

export const DraftPath = z.object({
  steps: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      owner: StepOwner,
      effortHours: z.object({ min: z.number(), max: z.number() }).nullable(),
      linkFindingId: z.string().nullable(),
      helper: HelperKind.nullable(),
      claims: z.array(DClaim),
    })
  ),
  gates: z.object({ provider: DGate, customerAdmin: DGate, endUser: DGate }),
  stuckPoints: z.array(
    z.object({ reason: z.string(), fix: z.string(), escalation: z.string().nullable(), claim: DClaim })
  ),
  whileYouWait: z.array(DClaim),
  keepsComingBack: z.array(DClaim),
  hardToUndo: z.array(DClaim),
});
export type DraftPath = z.infer<typeof DraftPath>;

// ---- Research pipeline intermediate types (not persisted on the Guide).
// Findings are produced by discover.ts and validated with the Findings
// schema; probes are produced by probe.ts. evidence.ts reads both to turn a
// DClaim into a labeled Claim. ----

export const Finding = z.object({
  id: z.string(), // F1, F2, ...
  topic: z.string(),
  statement: z.string(), // paraphrase, <= 40 words
  sourceUrl: z.string().url(),
  sourceTitle: z.string(),
  sourceType: SourceType,
  publishedYear: z.number().int().nullable(),
  excerpt: z.string(), // exact fragment, <= 20 words
  checkable: z.object({ url: z.string().url(), mustContain: z.array(z.string()) }).nullable(),
});
export type Finding = z.infer<typeof Finding>;

export const Findings = z.object({
  findings: z.array(Finding),
  notFound: z.array(z.string()),
});
export type Findings = z.infer<typeof Findings>;

// A Probe is one server-side fetch made to verify either a finding's excerpt
// (excerptFound) or a checkable's mustContain terms (mustContainAll). A probe
// "passes" (enables Tested) only when the page was readable and every
// mustContain term was present.
export const Probe = z.object({
  id: z.string(), // P1, P2, ...
  url: z.string().url(),
  status: z.number().int().nullable(), // HTTP status, null on network failure/timeout
  readable: z.boolean(), // fetched text length >= 500
  excerptFound: z.boolean(),
  mustContainAll: z.boolean(),
});
export type Probe = z.infer<typeof Probe>;

export const CheckVerdict = z.enum(["supported", "partial", "unsupported", "conflict"]);
export type CheckVerdict = z.infer<typeof CheckVerdict>;

export const CheckResult = z.object({
  claimId: z.string(),
  verdict: CheckVerdict,
  reason: z.string(),
});
export type CheckResult = z.infer<typeof CheckResult>;
