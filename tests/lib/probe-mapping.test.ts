import { describe, expect, it } from "vitest";
import { mapFindingsToCheckableProbeId } from "../../src/lib/research/probe";
import type { Finding } from "../../src/lib/schema";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "F1",
    topic: "x",
    statement: "x",
    sourceUrl: "https://example.com/a",
    sourceTitle: "x",
    sourceType: "official",
    publishedYear: 2026,
    excerpt: "x",
    checkable: null,
    ...overrides,
  };
}

describe("mapFindingsToCheckableProbeId", () => {
  it("maps a finding with a checkable to a probe id", () => {
    const findings = [finding({ id: "F1", checkable: { url: "https://example.com/a", mustContain: ["x"] } })];
    const map = mapFindingsToCheckableProbeId(findings);
    expect(map.get("F1")).toBeDefined();
  });

  it("omits findings with no checkable", () => {
    const findings = [finding({ id: "F1" })];
    expect(mapFindingsToCheckableProbeId(findings).has("F1")).toBe(false);
  });

  it("gives two findings sharing the same checkable the same probe id", () => {
    const findings = [
      finding({ id: "F1", checkable: { url: "https://example.com/a", mustContain: ["x"] } }),
      finding({ id: "F2", checkable: { url: "https://example.com/a", mustContain: ["x"] } }),
    ];
    const map = mapFindingsToCheckableProbeId(findings);
    expect(map.get("F1")).toBe(map.get("F2"));
  });

  it("caps at 10 distinct checkables", () => {
    const findings = Array.from({ length: 15 }, (_, i) =>
      finding({ id: `F${i}`, checkable: { url: `https://example.com/${i}`, mustContain: ["x"] } })
    );
    const map = mapFindingsToCheckableProbeId(findings);
    expect(map.size).toBe(10);
  });
});
