import { describe, expect, it } from "vitest";
import { computeCompleteness, type CompletenessInput } from "../../src/lib/completeness";
import type { Claim, Gate, Step } from "../../src/lib/schema";

function claim(label: Claim["label"] = "sourced"): Claim {
  return { id: "c1", text: "x", label, sources: [], testNote: null, uncertainReason: null, checked: "unchecked" };
}

function gate(overrides: Partial<Gate> = {}): Gate {
  return { applies: "yes", who: "x", what: "x", claims: [claim()], ...overrides };
}

function step(overrides: Partial<Step> = {}): Step {
  return {
    n: 1,
    title: "x",
    detail: "x",
    owner: "you_do",
    effort: null,
    linkUrl: null,
    helper: null,
    claims: [claim()],
    ...overrides,
  };
}

function completeInput(): CompletenessInput {
  return {
    tier: 2,
    scopes: [{ claim: claim() }],
    prerequisites: [{ claim: claim() }],
    steps: [step({ n: 1 }), step({ n: 2 }), step({ n: 3 })],
    gates: { provider: gate(), customerAdmin: gate(), endUser: gate() },
    stuckPoints: [{ claim: claim() }, { claim: claim() }],
  };
}

describe("computeCompleteness", () => {
  it("is complete when every requirement is met", () => {
    expect(computeCompleteness(completeInput())).toEqual({ status: "complete", thinSections: [] });
  });

  it("flags Verdict when tier is unknown", () => {
    const result = computeCompleteness({ ...completeInput(), tier: null });
    expect(result.status).toBe("incomplete");
    expect(result.thinSections).toContain("Verdict");
  });

  it("flags Scopes when there are none", () => {
    const result = computeCompleteness({ ...completeInput(), scopes: [] });
    expect(result.thinSections).toContain("Scopes");
  });

  it("flags Scopes when the only scope's claim is uncertain", () => {
    const result = computeCompleteness({ ...completeInput(), scopes: [{ claim: claim("uncertain") }] });
    expect(result.thinSections).toContain("Scopes");
  });

  it("flags Prepare before you start when there are no prerequisites", () => {
    const result = computeCompleteness({ ...completeInput(), prerequisites: [] });
    expect(result.thinSections).toContain("Prepare before you start");
  });

  it("flags Steps when there are fewer than 3", () => {
    const result = computeCompleteness({ ...completeInput(), steps: [step()] });
    expect(result.thinSections).toContain("Steps");
  });

  it("flags Steps when a step has no owner", () => {
    const input = completeInput();
    const result = computeCompleteness({
      ...input,
      steps: [...input.steps, { ...step({ n: 4 }), owner: undefined as unknown as Step["owner"] }],
    });
    expect(result.thinSections).toContain("Steps");
  });

  it("flags The three gates when no gate has a non-uncertain claim", () => {
    const result = computeCompleteness({
      ...completeInput(),
      gates: {
        provider: gate({ claims: [claim("uncertain")] }),
        customerAdmin: gate({ claims: [claim("uncertain")] }),
        endUser: gate({ claims: [] }),
      },
    });
    expect(result.thinSections).toContain("The three gates");
  });

  it("flags Where it gets stuck when there are fewer than 2 stuck points", () => {
    const result = computeCompleteness({ ...completeInput(), stuckPoints: [{ claim: claim() }] });
    expect(result.thinSections).toContain("Where it gets stuck");
  });
});
