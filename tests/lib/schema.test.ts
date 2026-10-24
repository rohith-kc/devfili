import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Guide } from "../../src/lib/schema";
import { computeCompleteness } from "../../src/lib/completeness";
import { computeTier } from "../../src/lib/tier";

function loadFixture(): unknown {
  const file = path.resolve(__dirname, "../fixtures/sample-guide.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("sample-guide fixture", () => {
  it("validates against the Guide schema", () => {
    const guide = Guide.parse(loadFixture());
    expect(guide.app.slug).toBe("sample-app");
    expect(guide.sample).toBe(true);
  });

  it("is visibly marked as a sample", () => {
    const guide = Guide.parse(loadFixture());
    expect(guide.sample).toBe(true);
  });

  it("exercises every evidence label", () => {
    const guide = Guide.parse(loadFixture());
    const allClaims = [
      guide.verdict.tierReason,
      ...guide.verdict.scopeForks,
      ...(guide.managedApp.claim ? [guide.managedApp.claim] : []),
      ...guide.managedApp.whatYouLose,
      ...guide.managedApp.whenToSwitch,
      ...guide.howItWorks.flow,
      ...guide.howItWorks.appTypes,
      ...guide.howItWorks.tokenNotes,
      ...guide.scopes.map((s) => s.claim),
      ...guide.prerequisites.map((p) => p.claim),
      ...guide.steps.flatMap((s) => s.claims),
      ...guide.gates.provider.claims,
      ...guide.gates.customerAdmin.claims,
      ...guide.gates.endUser.claims,
      ...guide.stuckPoints.map((p) => p.claim),
      ...guide.whileYouWait,
      ...guide.keepsComingBack,
      ...guide.hardToUndo,
    ];
    const labels = new Set(allClaims.map((c) => c.label));
    expect(labels).toEqual(new Set(["tested", "sourced", "uncertain"]));
  });

  it("exercises every step owner tag", () => {
    const guide = Guide.parse(loadFixture());
    const owners = new Set(guide.steps.map((s) => s.owner));
    expect(owners).toEqual(new Set(["agent_did", "agent_drafted", "you_do"]));
  });

  it("exercises every gate state across the three gates", () => {
    const guide = Guide.parse(loadFixture());
    const states = new Set([guide.gates.provider.applies, guide.gates.customerAdmin.applies, guide.gates.endUser.applies]);
    expect(states).toEqual(new Set(["yes", "unknown", "no"]));
  });

  it("lists every uncertain claim id in derived.unverifiedClaimIds and nowhere extra", () => {
    const guide = Guide.parse(loadFixture());
    const allClaims = [
      guide.verdict.tierReason,
      ...(guide.managedApp.claim ? [guide.managedApp.claim] : []),
      ...guide.managedApp.whatYouLose,
      ...guide.scopes.map((s) => s.claim),
      ...guide.gates.provider.claims,
      ...guide.gates.customerAdmin.claims,
      ...guide.gates.endUser.claims,
      ...guide.hardToUndo,
    ];
    const uncertainIds = allClaims.filter((c) => c.label === "uncertain").map((c) => c.id);
    for (const id of uncertainIds) {
      expect(guide.derived.unverifiedClaimIds).toContain(id);
    }
  });

  it("agrees with computeTier and computeCompleteness given its own facts", () => {
    const guide = Guide.parse(loadFixture());
    // facts matching the fixture's tier 2 (review required, not partner gated, not security assessed)
    const tierResult = computeTier({
      partnerGated: { value: false, claim: null },
      securityAssessment: { value: false, claim: null },
      reviewRequired: { value: true, claim: guide.verdict.tierReason },
    });
    expect(tierResult.tier).toBe(guide.verdict.tier);

    const completeness = computeCompleteness({
      tier: guide.verdict.tier,
      scopes: guide.scopes,
      prerequisites: guide.prerequisites,
      steps: guide.steps,
      gates: guide.gates,
      stuckPoints: guide.stuckPoints,
    });
    expect(completeness).toEqual(guide.completeness);
  });
});
