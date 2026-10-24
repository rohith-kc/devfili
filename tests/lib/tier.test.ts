import { describe, expect, it } from "vitest";
import { computeTier, customerAdminGateState, gatedAccess, type LabeledFact } from "../../src/lib/tier";

const trueFact: LabeledFact = { value: true, claim: null };
const falseFact: LabeledFact = { value: false, claim: null };
const unknownFact: LabeledFact = { value: null, claim: null };

describe("computeTier", () => {
  it("partner gated wins over everything else", () => {
    expect(computeTier({ partnerGated: trueFact, securityAssessment: trueFact, reviewRequired: trueFact })).toEqual({
      tier: 4,
      reasonKey: "partner_gated",
    });
  });

  it("security assessment gives tier 3 when not partner gated", () => {
    expect(
      computeTier({ partnerGated: falseFact, securityAssessment: trueFact, reviewRequired: trueFact })
    ).toEqual({ tier: 3, reasonKey: "security_assessment" });
  });

  it("review required gives tier 2 when neither partner gated nor security assessed", () => {
    expect(
      computeTier({ partnerGated: falseFact, securityAssessment: falseFact, reviewRequired: trueFact })
    ).toEqual({ tier: 2, reasonKey: "review_required" });
  });

  it("all three explicitly false gives tier 1 (self-serve)", () => {
    expect(
      computeTier({ partnerGated: falseFact, securityAssessment: falseFact, reviewRequired: falseFact })
    ).toEqual({ tier: 1, reasonKey: "self_serve" });
  });

  it("unknown facts never default to tier 1", () => {
    expect(
      computeTier({ partnerGated: unknownFact, securityAssessment: falseFact, reviewRequired: falseFact })
    ).toEqual({ tier: null, reasonKey: "unknown" });
  });

  it("all unknown gives Unknown", () => {
    expect(
      computeTier({ partnerGated: unknownFact, securityAssessment: unknownFact, reviewRequired: unknownFact })
    ).toEqual({ tier: null, reasonKey: "unknown" });
  });
});

describe("customerAdminGateState", () => {
  it("maps true/false/null to yes/no/unknown", () => {
    expect(customerAdminGateState(true)).toBe("yes");
    expect(customerAdminGateState(false)).toBe("no");
    expect(customerAdminGateState(null)).toBe("unknown");
  });
});

describe("gatedAccess", () => {
  it("is true only for tier 4", () => {
    expect(gatedAccess(4)).toBe(true);
    expect(gatedAccess(1)).toBe(false);
    expect(gatedAccess(null)).toBe(false);
  });
});
