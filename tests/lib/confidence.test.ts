import { describe, expect, it } from "vitest";
import { computeConfidence } from "../../src/lib/confidence";
import type { Claim, Range, Source } from "../../src/lib/schema";

function claim(label: Claim["label"]): Claim {
  return { id: "c1", text: "x", label, sources: [], testNote: null, uncertainReason: null, checked: "unchecked" };
}

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

function range(overrides: Partial<Range> = {}): Range {
  return { min: 1, max: 2, unit: "weeks", basis: "official", claimId: "c1", ...overrides };
}

describe("computeConfidence", () => {
  it("is high when tier is known, no tier claim is uncertain, and wait is official", () => {
    expect(
      computeConfidence({ tier: 2, tierFactClaims: [claim("sourced")], wait: range({ basis: "official" }), sources: [] })
    ).toBe("high");
  });

  it("is low when tier is null", () => {
    expect(computeConfidence({ tier: null, tierFactClaims: [], wait: null, sources: [] })).toBe("low");
  });

  it("is low when the wait basis is estimated", () => {
    expect(
      computeConfidence({ tier: 1, tierFactClaims: [], wait: range({ basis: "estimated" }), sources: [] })
    ).toBe("low");
  });

  it("is low when any tier-fact claim is uncertain", () => {
    expect(
      computeConfidence({
        tier: 2,
        tierFactClaims: [claim("uncertain")],
        wait: range({ basis: "official" }),
        sources: [],
      })
    ).toBe("low");
  });

  it("is low when the only sources are community sources older than 2 years", () => {
    expect(
      computeConfidence({
        tier: 1,
        tierFactClaims: [],
        wait: null,
        sources: [source({ type: "community", oldSource: true })],
      })
    ).toBe("low");
  });

  it("is medium for a mix (tier known, wait only reported)", () => {
    expect(
      computeConfidence({ tier: 2, tierFactClaims: [claim("sourced")], wait: range({ basis: "reported" }), sources: [] })
    ).toBe("medium");
  });

  it("is medium when tier is known and there is no wait range at all", () => {
    expect(computeConfidence({ tier: 1, tierFactClaims: [claim("tested")], wait: null, sources: [] })).toBe("medium");
  });
});
