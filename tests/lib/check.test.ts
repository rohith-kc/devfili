import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/lib/llm/router";

vi.mock("../../src/lib/llm/gemini", () => ({ geminiGenerate: vi.fn() }));
vi.mock("../../src/lib/llm/groq", () => ({ groqComplete: vi.fn() }));

import { geminiGenerate } from "../../src/lib/llm/gemini";
import { groqComplete } from "../../src/lib/llm/groq";
import { runCheck, type ClaimForCheck } from "../../src/lib/research/check";

const mockGemini = vi.mocked(geminiGenerate);
const mockGroq = vi.mocked(groqComplete);

const TODAY = "2026-10-24";
const env: Env = {
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

function claim(id: string, url = "https://example.com/a"): ClaimForCheck {
  return { claimId: id, text: "x", urls: [url], excerpts: ["x"] };
}

describe("runCheck", () => {
  beforeEach(() => {
    mockGemini.mockReset();
    mockGroq.mockReset();
  });

  it("returns empty results for no claims without calling any provider", async () => {
    const result = await runCheck(env, TODAY, []);
    expect(result.results).toEqual([]);
    expect(mockGemini).not.toHaveBeenCalled();
  });

  it("uses Gemini when providerCheck is gemini", async () => {
    mockGemini.mockResolvedValue({ text: JSON.stringify([{ claimId: "c1", verdict: "supported", reason: "matches" }]), totalTokens: 1 });
    const result = await runCheck(env, TODAY, [claim("c1")]);
    expect(result.results).toEqual([{ claimId: "c1", verdict: "supported", reason: "matches" }]);
    expect(result.usedFallback).toBe(false);
  });

  it("falls back to the Groq excerpts-only checker when Gemini fails", async () => {
    mockGemini.mockRejectedValue(new Error("UNAVAILABLE"));
    mockGroq.mockResolvedValue({ text: JSON.stringify([{ claimId: "c1", verdict: "partial", reason: "qualifies it" }]), totalTokens: 1 });
    const result = await runCheck(env, TODAY, [claim("c1")]);
    expect(result.usedFallback).toBe(true);
    expect(result.results).toEqual([{ claimId: "c1", verdict: "partial", reason: "qualifies it" }]);
  }, 10000);

  it("uses the Groq checker directly when providerCheck is groq", async () => {
    mockGroq.mockResolvedValue({ text: JSON.stringify([{ claimId: "c1", verdict: "unsupported", reason: "no mention" }]), totalTokens: 1 });
    const result = await runCheck({ ...env, providerCheck: "groq" }, TODAY, [claim("c1")]);
    expect(mockGemini).not.toHaveBeenCalled();
    expect(result.usedFallback).toBe(true);
    expect(result.results[0].verdict).toBe("unsupported");
  });

  it("splits claims into separate batches once distinct URLs exceed 10", async () => {
    mockGemini.mockResolvedValue({ text: JSON.stringify([]), totalTokens: 1 });
    const claims = Array.from({ length: 12 }, (_, i) => claim(`c${i}`, `https://example.com/${i}`));
    await runCheck(env, TODAY, claims);
    expect(mockGemini.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("leaves a batch unresolved (not thrown) when both providers fail", async () => {
    mockGemini.mockRejectedValue(new Error("boom"));
    mockGroq.mockRejectedValue(new Error("boom"));
    const result = await runCheck(env, TODAY, [claim("c1")]);
    expect(result.results).toEqual([]);
  }, 10000);

  it("caps at 40 claims", async () => {
    mockGemini.mockResolvedValue({ text: JSON.stringify([]), totalTokens: 1 });
    const claims = Array.from({ length: 60 }, (_, i) => claim(`c${i}`, `https://example.com/${i % 5}`));
    await runCheck(env, TODAY, claims);
    const totalClaimIdMentions = mockGemini.mock.calls.reduce(
      (sum, call) => sum + ((call[0].prompt as string).match(/"claimId":"c\d+"/g)?.length ?? 0),
      0
    );
    expect(totalClaimIdMentions).toBeLessThanOrEqual(40);
  });
});
