import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/lib/llm/router";

vi.mock("../../src/lib/llm/gemini", () => ({ geminiGenerate: vi.fn() }));
vi.mock("../../src/lib/llm/groq", () => ({ groqBrowserSearch: vi.fn(), groqComplete: vi.fn() }));

import { geminiGenerate } from "../../src/lib/llm/gemini";
import { groqBrowserSearch, groqComplete } from "../../src/lib/llm/groq";
import { discover } from "../../src/lib/research/discover";

const mockGemini = vi.mocked(geminiGenerate);
const mockGroqSearch = vi.mocked(groqBrowserSearch);
const mockGroqComplete = vi.mocked(groqComplete);

const TODAY = "2026-10-24";

const baseEnv: Env = {
  geminiApiKey: "g",
  geminiModelResearch: "gemini-flash-latest",
  geminiModelCheck: "gemini-flash-latest",
  groqApiKey: "k",
  groqBaseUrl: "https://api.groq.com/openai/v1",
  groqModelDraft: "openai/gpt-oss-120b",
  groqModelFast: "openai/gpt-oss-20b",
  openrouterApiKey: "",
  openrouterBaseUrl: "https://openrouter.ai/api/v1",
  openrouterModel: "meta-llama/llama-3.3-70b-instruct",
  providerResearch: "gemini",
  providerCheck: "gemini",
};

function validFindingsJson(n: number, group = "a"): string {
  return JSON.stringify({
    findings: Array.from({ length: n }, (_, i) => ({
      topic: "review_required",
      statement: `Finding ${group}-${i}`,
      sourceUrl: `https://developer.example.com/docs/${group}-${i}`,
      sourceTitle: "Docs",
      sourceType: "official",
      publishedYear: 2026,
      excerpt: "some exact fragment",
      checkable: null,
    })),
    notFound: [],
  });
}

describe("discover", () => {
  beforeEach(() => {
    mockGemini.mockReset();
    mockGroqSearch.mockReset();
    mockGroqComplete.mockReset();
  });

  it("merges and assigns ids to findings from both parallel Gemini calls", async () => {
    mockGemini
      .mockResolvedValueOnce({ text: validFindingsJson(2, "official"), totalTokens: 10 })
      .mockResolvedValueOnce({ text: validFindingsJson(1, "community"), totalTokens: 10 });

    const result = await discover(baseEnv, "Example", "https://example.com", TODAY);
    expect(result.findings).toHaveLength(3);
    expect(result.findings.map((f) => f.id)).toEqual(["F1", "F2", "F3"]);
  });

  it("drops findings with an invalid sourceUrl", async () => {
    const bad = JSON.stringify({ findings: [{ topic: "x", statement: "x", sourceUrl: "not a url", sourceTitle: "x", sourceType: "official", publishedYear: null, excerpt: "x", checkable: null }], notFound: [] });
    mockGemini.mockResolvedValueOnce({ text: bad, totalTokens: 1 }).mockResolvedValueOnce({ text: validFindingsJson(1, "community"), totalTokens: 1 });

    const result = await discover(baseEnv, "Example", "https://example.com", TODAY);
    expect(result.findings).toHaveLength(1);
  });

  it("dedupes findings that share the same sourceUrl and statement", async () => {
    mockGemini
      .mockResolvedValueOnce({ text: validFindingsJson(2, "same"), totalTokens: 1 })
      .mockResolvedValueOnce({ text: validFindingsJson(2, "same"), totalTokens: 1 }); // identical findings

    const result = await discover(baseEnv, "Example", "https://example.com", TODAY);
    expect(result.findings).toHaveLength(2);
  });

  it("falls back to Groq browser_search when Gemini fails on both attempts", async () => {
    mockGemini.mockRejectedValue(new Error("UNAVAILABLE"));
    mockGroqSearch
      .mockResolvedValueOnce({
        text: JSON.stringify({ findings: [{ topic: "x", statement: "official finding", sourceUrl: "https://developer.example.com/a", sourceTitle: "x", sourceType: "official", publishedYear: 2026, excerpt: "x", checkable: null }], notFound: [] }),
        totalTokens: 1,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ findings: [{ topic: "x", statement: "community finding", sourceUrl: "https://community.example.com/b", sourceTitle: "x", sourceType: "community", publishedYear: 2026, excerpt: "x", checkable: null }], notFound: [] }),
        totalTokens: 1,
      });

    const result = await discover(baseEnv, "Example", "https://example.com", TODAY);
    expect(result.findings).toHaveLength(2); // one from each of the two sides' fallback
    expect(mockGroqSearch).toHaveBeenCalled();
  }, 10000);

  it("calls groqBrowserSearch directly when providerResearch is groq (no Gemini call at all)", async () => {
    mockGroqSearch.mockResolvedValue({ text: validFindingsJson(1), totalTokens: 1 });
    const result = await discover({ ...baseEnv, providerResearch: "groq" }, "Example", "https://example.com", TODAY);
    expect(mockGemini).not.toHaveBeenCalled();
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("repairs malformed JSON with one Groq FAST call", async () => {
    mockGemini
      .mockResolvedValueOnce({ text: "not json at all, sorry", totalTokens: 1 })
      .mockResolvedValueOnce({ text: validFindingsJson(1), totalTokens: 1 });
    mockGroqComplete.mockResolvedValue({ text: validFindingsJson(1), totalTokens: 1 });

    const result = await discover(baseEnv, "Example", "https://example.com", TODAY);
    expect(mockGroqComplete).toHaveBeenCalledTimes(1);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("returns no findings (not a crash) when everything fails", async () => {
    mockGemini.mockRejectedValue(new Error("boom"));
    mockGroqSearch.mockRejectedValue(new Error("boom"));
    const result = await discover(baseEnv, "Example", "https://example.com", TODAY);
    expect(result.findings).toHaveLength(0);
  }, 10000);
});
