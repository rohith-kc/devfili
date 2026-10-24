import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "../../src/lib/schema";
import { containsNormalized, htmlToText, normalizeForMatch } from "../../src/lib/research/probe";

vi.mock("../../src/lib/safety/ssrf", () => ({ safeFetch: vi.fn() }));

import { safeFetch } from "../../src/lib/safety/ssrf";
import { probeFindings } from "../../src/lib/research/probe";

const mockSafeFetch = vi.mocked(safeFetch);

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "F1",
    topic: "review_required",
    statement: "x",
    sourceUrl: "https://example.com/docs",
    sourceTitle: "Docs",
    sourceType: "official",
    publishedYear: 2026,
    excerpt: "all public apps must pass review",
    checkable: null,
    ...overrides,
  };
}

describe("htmlToText / normalizeForMatch / containsNormalized", () => {
  it("strips tags and keeps text content", () => {
    expect(htmlToText("<html><body><p>Hello <b>world</b></p></body></html>")).toContain("Hello");
  });

  it("normalizes case and punctuation for matching", () => {
    expect(normalizeForMatch("All Public Apps—must pass review.")).toBe("all public apps must pass review");
  });

  it("matches an excerpt despite punctuation/case differences", () => {
    expect(containsNormalized("Note: All Public Apps must pass review before launch.", "all public apps must pass review")).toBe(
      true
    );
  });

  it("does not match when the text truly isn't present", () => {
    expect(containsNormalized("Nothing relevant here.", "all public apps must pass review")).toBe(false);
  });
});

describe("probeFindings", () => {
  beforeEach(() => {
    mockSafeFetch.mockReset();
  });

  it("marks a page unreadable when fetch fails", async () => {
    mockSafeFetch.mockResolvedValue({ ok: false, status: null, text: null, finalUrl: "https://example.com/docs", error: "timeout" });
    const [probe] = await probeFindings([finding()]);
    expect(probe.readable).toBe(false);
    expect(probe.excerptFound).toBe(false);
  });

  it("marks a page unreadable when the fetched text is shorter than 500 chars", async () => {
    mockSafeFetch.mockResolvedValue({ ok: true, status: 200, text: "<p>short</p>", finalUrl: "https://example.com/docs" });
    const [probe] = await probeFindings([finding()]);
    expect(probe.readable).toBe(false);
  });

  it("finds the excerpt in a long, readable page", async () => {
    const body = "<p>" + "filler ".repeat(100) + "All public apps must pass review before launch." + "</p>";
    mockSafeFetch.mockResolvedValue({ ok: true, status: 200, text: body, finalUrl: "https://example.com/docs" });
    const [probe] = await probeFindings([finding()]);
    expect(probe.readable).toBe(true);
    expect(probe.excerptFound).toBe(true);
  });

  it("reports mismatch (excerptFound false) when the page is readable but lacks the excerpt", async () => {
    const body = "<p>" + "filler ".repeat(100) + "</p>";
    mockSafeFetch.mockResolvedValue({ ok: true, status: 200, text: body, finalUrl: "https://example.com/docs" });
    const [probe] = await probeFindings([finding()]);
    expect(probe.readable).toBe(true);
    expect(probe.excerptFound).toBe(false);
  });

  it("passes mustContainAll only when every term is present", async () => {
    const body = "<p>" + "filler ".repeat(100) + "requires scopes read and write" + "</p>";
    mockSafeFetch.mockResolvedValue({ ok: true, status: 200, text: body, finalUrl: "https://example.com/checkable" });
    const probes = await probeFindings([
      finding({ checkable: { url: "https://example.com/checkable", mustContain: ["read", "write"] } }),
    ]);
    // one probe for the sourceUrl (P1), one for the checkable (P2)
    expect(probes).toHaveLength(2);
    expect(probes[1].mustContainAll).toBe(true);
  });

  it("fails mustContainAll when a term is missing", async () => {
    const body = "<p>" + "filler ".repeat(100) + "requires scope read only" + "</p>";
    mockSafeFetch.mockResolvedValue({ ok: true, status: 200, text: body, finalUrl: "https://example.com/checkable" });
    const probes = await probeFindings([
      finding({ checkable: { url: "https://example.com/checkable", mustContain: ["read", "write"] } }),
    ]);
    expect(probes[1].mustContainAll).toBe(false);
  });

  it("caps distinct source URLs at 15 and dedupes repeats", async () => {
    mockSafeFetch.mockResolvedValue({ ok: true, status: 200, text: "<p>" + "x ".repeat(300) + "</p>", finalUrl: "https://example.com/1" });
    const findings = Array.from({ length: 20 }, (_, i) => finding({ id: `F${i}`, sourceUrl: `https://example.com/${i}` }));
    findings.push(finding({ id: "Fdup", sourceUrl: "https://example.com/0" })); // duplicate of the first
    const probes = await probeFindings(findings);
    expect(probes).toHaveLength(15);
  });
});
