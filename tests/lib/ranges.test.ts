import { describe, expect, it } from "vitest";
import { computeBasis, computeEffortRange, computeWaitRange, formatRange } from "../../src/lib/ranges";
import type { Claim, Source, Step } from "../../src/lib/schema";

function source(overrides: Partial<Source> = {}): Source {
  return {
    url: "https://example.com",
    title: "x",
    type: "official",
    accessedOn: "2026-10-24",
    publishedYear: 2024,
    oldSource: false,
    recheck: "confirmed",
    ...overrides,
  };
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return { id: "c1", text: "x", label: "sourced", sources: [source()], testNote: null, uncertainReason: null, checked: "unchecked", ...overrides };
}

describe("computeBasis", () => {
  it("is estimated when there is no claim", () => {
    expect(computeBasis(null)).toBe("estimated");
  });

  it("is estimated when the claim has no sources", () => {
    expect(computeBasis(claim({ sources: [] }))).toBe("estimated");
  });

  it("is official when an official source backs a non-uncertain claim", () => {
    expect(computeBasis(claim({ sources: [source({ type: "official" })] }))).toBe("official");
  });

  it("is reported when only community/vendor sources back the claim", () => {
    expect(computeBasis(claim({ sources: [source({ type: "community" })] }))).toBe("reported");
  });

  it("is reported when an official source exists but the claim is uncertain", () => {
    expect(computeBasis(claim({ label: "uncertain", sources: [source({ type: "official" })] }))).toBe("reported");
  });
});

describe("computeWaitRange", () => {
  it("is null when there is no wait", () => {
    expect(computeWaitRange(null)).toBeNull();
  });

  it("carries the unit through and derives basis/claimId from the claim", () => {
    const c = claim();
    expect(computeWaitRange({ min: 7, max: 10, unit: "business_days", claim: c })).toEqual({
      min: 7,
      max: 10,
      unit: "business_days",
      basis: "official",
      claimId: "c1",
    });
  });
});

function step(overrides: Partial<Step> = {}): Step {
  return {
    n: 1,
    title: "x",
    detail: "x",
    owner: "you_do",
    effort: { min: 1, max: 2, unit: "hours", basis: "official", claimId: "c1" },
    linkUrl: null,
    helper: null,
    claims: [],
    ...overrides,
  };
}

describe("computeEffortRange", () => {
  it("is null when there are no you_do steps with effort", () => {
    expect(computeEffortRange([step({ owner: "agent_did", effort: null })])).toBeNull();
  });

  it("sums effort only across you_do steps", () => {
    const result = computeEffortRange([
      step({ effort: { min: 1, max: 2, unit: "hours", basis: "official", claimId: "c1" } }),
      step({ effort: { min: 3, max: 4, unit: "hours", basis: "official", claimId: "c2" } }),
      step({ owner: "agent_did", effort: null }),
    ]);
    expect(result).toEqual({ min: 4, max: 6, unit: "hours", basis: "official", claimId: null });
  });

  it("uses the weakest basis among contributing steps", () => {
    const result = computeEffortRange([
      step({ effort: { min: 1, max: 2, unit: "hours", basis: "official", claimId: "c1" } }),
      step({ effort: { min: 1, max: 2, unit: "hours", basis: "estimated", claimId: "c2" } }),
    ]);
    expect(result?.basis).toBe("estimated");
  });
});

describe("formatRange", () => {
  it("formats hours under the threshold as hours", () => {
    expect(formatRange({ min: 2, max: 4, unit: "hours", basis: "official", claimId: null })).toBe("2-4 hours");
  });

  it("formats weeks", () => {
    expect(formatRange({ min: 1, max: 3, unit: "weeks", basis: "reported", claimId: null })).toBe("1-3 weeks");
  });

  it("formats business days", () => {
    expect(formatRange({ min: 7, max: 10, unit: "business_days", basis: "official", claimId: null })).toBe(
      "7-10 business days"
    );
  });

  it("converts hours over 16 into days", () => {
    expect(formatRange({ min: 16, max: 24, unit: "hours", basis: "official", claimId: null })).toBe("2-3 days");
  });

  it("collapses equal min and max into a single number", () => {
    expect(formatRange({ min: 2, max: 2, unit: "hours", basis: "official", claimId: null })).toBe("2 hours");
  });
});
