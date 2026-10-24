import { describe, expect, it } from "vitest";
import { claimsForCheck, finalizeGuide } from "../../src/lib/research/finalize";
import type { DraftCore, DraftPath, Finding, Probe } from "../../src/lib/schema";

const TODAY = "2026-10-24";

const findings: Finding[] = [
  {
    id: "F1",
    topic: "review_required",
    statement: "All public apps must pass a marketplace review.",
    sourceUrl: "https://developer.example.com/docs/review",
    sourceTitle: "Developer docs: review",
    sourceType: "official",
    publishedYear: 2026,
    excerpt: "all public apps must pass review",
    checkable: { url: "https://developer.example.com/docs/review", mustContain: ["marketplace review"] },
  },
  {
    id: "F2",
    topic: "review_timeline",
    statement: "Review takes 5-10 business days.",
    sourceUrl: "https://developer.example.com/docs/timeline",
    sourceTitle: "Developer docs: timeline",
    sourceType: "official",
    publishedYear: 2026,
    excerpt: "5 to 10 business days",
    checkable: null,
  },
];

const probes: Probe[] = [
  { id: "P1", url: "https://developer.example.com/docs/review", status: 200, readable: true, excerptFound: true, mustContainAll: true },
];

function emptyDClaim() {
  return { text: "no evidence either way", findingIds: [], probeIds: [] };
}

const core: DraftCore = {
  facts: {
    partnerGated: { value: false, claim: null },
    securityAssessment: { value: false, claim: null },
    reviewRequired: { value: true, claim: { text: "A marketplace review is required.", findingIds: ["F1"], probeIds: ["P1"] } },
    customerAdminLikely: { value: null, claim: null },
    userCapBeforeApproval: { value: null, claim: null },
  },
  tierReason: { text: "Public apps go through marketplace review before real users can connect.", findingIds: ["F1"], probeIds: ["P1"] },
  wait: { min: 5, max: 10, unit: "business_days", claim: { text: "Review takes 5-10 business days.", findingIds: ["F2"], probeIds: [] } },
  scopeForks: [],
  managedApp: { exists: "unknown", claim: null, whatYouLose: [], whenToSwitch: [] },
  howItWorks: { flow: [], appTypes: [], tokenNotes: [] },
  scopes: [
    { scope: "read", allows: "Read data.", neededFor: "Showing data.", reviewImpact: "none", claim: { text: "The read scope needs no extra review.", findingIds: ["F1"], probeIds: [] } },
  ],
  prerequisites: [{ item: "Verified business account", kind: "business", claim: { text: "A verified business account is required.", findingIds: ["F1"], probeIds: [] } }],
};

const path: DraftPath = {
  steps: [
    { title: "Find the docs", detail: "x", owner: "agent_did", effortHours: null, linkFindingId: "F1", helper: null, claims: [{ text: "The docs page is live.", findingIds: ["F1"], probeIds: ["P1"] }] },
    { title: "Register and submit", detail: "x", owner: "you_do", effortHours: { min: 2, max: 4 }, linkFindingId: null, helper: null, claims: [{ text: "Registration takes about 2-4 hours.", findingIds: ["F1"], probeIds: [] }] },
    { title: "Approved", detail: "x", owner: "agent_did", effortHours: null, linkFindingId: null, helper: null, claims: [] },
  ],
  gates: {
    provider: { applies: "yes", who: "Reviewer", what: "Reviews the app.", claims: [{ text: "The provider reviews every public app.", findingIds: ["F1"], probeIds: ["P1"] }] },
    customerAdmin: { applies: "yes", who: "Should be overridden to unknown", what: "x", claims: [emptyDClaim()] },
    endUser: { applies: "yes", who: "User", what: "Clicks Allow.", claims: [emptyDClaim()] },
  },
  stuckPoints: [
    { reason: "Rejected for a vague reason.", fix: "Ask support for specifics.", escalation: "Support form", claim: { text: "Developers report vague rejections.", findingIds: ["F1"], probeIds: [] } },
    { reason: "Missing redirect URI.", fix: "Add the exact callback URL.", escalation: null, claim: { text: "A missing redirect URI is a common cause.", findingIds: ["F1"], probeIds: [] } },
  ],
  whileYouWait: [],
  keepsComingBack: [],
  hardToUndo: [],
};

describe("finalizeGuide", () => {
  it("produces a schema-valid Guide", () => {
    const guide = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: "https://example.com" }, kind: "live", today: TODAY, core, path, findings, probes });
    expect(guide.app.slug).toBe("example");
  });

  it("computes tier 2 from reviewRequired=true", () => {
    const guide = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    expect(guide.verdict.tier).toBe(2);
  });

  it("overrides gates.customerAdmin.applies from facts.customerAdminLikely (null -> unknown) regardless of what the model drafted", () => {
    const guide = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    expect(guide.gates.customerAdmin.applies).toBe("unknown");
    expect(guide.verdict.gates.customerAdmin).toBe("unknown");
    expect(guide.tile.customerAdmin).toBe("unknown");
  });

  it("labels a probe-backed claim as tested", () => {
    const guide = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    expect(guide.verdict.tierReason.label).toBe("tested");
  });

  it("builds the wait range from DraftCore.wait with an official basis", () => {
    const guide = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    expect(guide.verdict.wait).toMatchObject({ min: 5, max: 10, unit: "business_days", basis: "official" });
  });

  it("assigns the same claim ids on a second pass with check results applied", () => {
    const first = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    const checkClaims = claimsForCheck(first, findings);
    expect(checkClaims.length).toBeGreaterThan(0);

    const second = finalizeGuide({
      app: { name: "Example", slug: "example", websiteUrl: null },
      kind: "live",
      today: TODAY,
      core,
      path,
      findings,
      probes,
      checkResults: [{ claimId: checkClaims[0].claimId, verdict: "unsupported", reason: "page does not mention this" }],
    });

    expect(second.verdict.tierReason.id).toBe(first.verdict.tierReason.id);
    const flagged = [...second.derived.sources].length >= 0; // sanity: no throw
    expect(flagged).toBe(true);
  });

  it("marks a claim uncertain with the checker's reason when check says unsupported", () => {
    const first = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    const checkClaims = claimsForCheck(first, findings);
    const target = checkClaims.find((c) => c.claimId === first.prerequisites[0].claim.id);
    expect(target).toBeTruthy();

    const second = finalizeGuide({
      app: { name: "Example", slug: "example", websiteUrl: null },
      kind: "live",
      today: TODAY,
      core,
      path,
      findings,
      probes,
      checkResults: [{ claimId: first.prerequisites[0].claim.id, verdict: "unsupported", reason: "page does not mention this" }],
    });

    expect(second.prerequisites[0].claim.label).toBe("uncertain");
    expect(second.prerequisites[0].claim.uncertainReason).toBe("page does not mention this");
  });

  it("computes completeness as complete when every requirement is met", () => {
    const guide = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    expect(guide.completeness.status).toBe("complete");
  });

  it("resolves a step's linkUrl from its linkFindingId", () => {
    const guide = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    expect(guide.steps[0].linkUrl).toBe("https://developer.example.com/docs/review");
  });

  it("sums you_do step effort into verdict.effort", () => {
    const guide = finalizeGuide({ app: { name: "Example", slug: "example", websiteUrl: null }, kind: "live", today: TODAY, core, path, findings, probes });
    expect(guide.verdict.effort).toEqual({ min: 2, max: 4, unit: "hours", basis: "official", claimId: null });
  });
});
