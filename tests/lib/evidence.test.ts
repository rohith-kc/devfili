import { describe, expect, it } from "vitest";
import { applyCheckResult, labelClaim } from "../../src/lib/evidence";
import type { Finding, Probe } from "../../src/lib/schema";

const TODAY = "2026-10-24";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "F1",
    topic: "review_required",
    statement: "Apps must pass a marketplace review before going live.",
    sourceUrl: "https://developer.example.com/docs/review",
    sourceTitle: "Developer docs: review",
    sourceType: "official",
    publishedYear: 2025,
    excerpt: "all public apps must pass marketplace review",
    checkable: null,
    ...overrides,
  };
}

function probe(overrides: Partial<Probe> = {}): Probe {
  return {
    id: "P1",
    url: "https://developer.example.com/docs/review",
    status: 200,
    readable: true,
    excerptFound: true,
    mustContainAll: true,
    ...overrides,
  };
}

describe("labelClaim", () => {
  it("drops hallucinated ids and labels uncertain with no supporting source", () => {
    const result = labelClaim({ text: "x", findingIds: ["F999"], probeIds: ["P999"] }, [finding()], [probe()], TODAY);
    expect(result.label).toBe("uncertain");
    expect(result.uncertainReason).toBe("no supporting source");
    expect(result.sources).toHaveLength(0);
  });

  it("labels tested when a cited probe passed", () => {
    const result = labelClaim(
      { text: "x", findingIds: ["F1"], probeIds: ["P1"] },
      [finding()],
      [probe()],
      TODAY
    );
    expect(result.label).toBe("tested");
    expect(result.testNote).toContain(probe().url);
  });

  it("never labels tested when neverTested is set, even with a passing probe", () => {
    const result = labelClaim(
      { text: "x", findingIds: ["F1"], probeIds: ["P1"] },
      [finding()],
      [probe()],
      TODAY,
      { neverTested: true }
    );
    expect(result.label).toBe("sourced");
  });

  it("labels sourced when a finding exists but nothing was probed", () => {
    const result = labelClaim({ text: "x", findingIds: ["F1"], probeIds: [] }, [finding()], [], TODAY);
    expect(result.label).toBe("sourced");
    expect(result.sources[0].recheck).toBe("not_rechecked");
  });

  it("labels uncertain with 'quoted fragment not found' when all sources mismatch", () => {
    const result = labelClaim(
      { text: "x", findingIds: ["F1"], probeIds: [] },
      [finding()],
      [probe({ excerptFound: false, mustContainAll: false })],
      TODAY
    );
    expect(result.label).toBe("uncertain");
    expect(result.uncertainReason).toBe("quoted fragment not found at source");
    expect(result.sources[0].recheck).toBe("mismatch");
  });

  it("labels uncertain with 'source could not be opened' on a 404 with no mismatch", () => {
    const result = labelClaim(
      { text: "x", findingIds: ["F1"], probeIds: [] },
      [finding()],
      [probe({ status: 404, readable: false, excerptFound: false, mustContainAll: false })],
      TODAY
    );
    expect(result.label).toBe("uncertain");
    expect(result.uncertainReason).toBe("source could not be opened");
    expect(result.sources[0].recheck).toBe("not_rechecked");
  });

  it("stays sourced when only some sources mismatch", () => {
    const result = labelClaim(
      { text: "x", findingIds: ["F1", "F2"], probeIds: [] },
      [finding(), finding({ id: "F2", sourceUrl: "https://developer.example.com/other" })],
      [
        probe({ excerptFound: false, mustContainAll: false }),
        probe({ id: "P2", url: "https://developer.example.com/other", excerptFound: true }),
      ],
      TODAY
    );
    expect(result.label).toBe("sourced");
  });

  it("flags community sources older than 2 years as old", () => {
    const result = labelClaim(
      { text: "x", findingIds: ["F1"], probeIds: [] },
      [finding({ sourceType: "community", publishedYear: 2023 })],
      [],
      TODAY
    );
    expect(result.sources[0].oldSource).toBe(true);
  });

  it("never flags official sources as old regardless of age", () => {
    const result = labelClaim(
      { text: "x", findingIds: ["F1"], probeIds: [] },
      [finding({ sourceType: "official", publishedYear: 2010 })],
      [],
      TODAY
    );
    expect(result.sources[0].oldSource).toBe(false);
  });
});

describe("applyCheckResult", () => {
  const base = { label: "sourced" as const, sources: [], testNote: null, uncertainReason: null };

  it("turns unsupported into uncertain with the checker's reason", () => {
    const result = applyCheckResult(base, { claimId: "c1", verdict: "unsupported", reason: "page says nothing about this" });
    expect(result.label).toBe("uncertain");
    expect(result.uncertainReason).toBe("page says nothing about this");
  });

  it("turns conflict into uncertain with the checker's reason", () => {
    const result = applyCheckResult(base, { claimId: "c1", verdict: "conflict", reason: "page gives a different number" });
    expect(result.label).toBe("uncertain");
  });

  it("leaves the label unchanged for partial and supported", () => {
    expect(applyCheckResult(base, { claimId: "c1", verdict: "partial", reason: "qualifies it" }).label).toBe("sourced");
    expect(applyCheckResult(base, { claimId: "c1", verdict: "supported", reason: "matches" }).label).toBe("sourced");
  });

  it("passes through unchanged when there is no check result", () => {
    expect(applyCheckResult(base, undefined)).toEqual(base);
  });
});
