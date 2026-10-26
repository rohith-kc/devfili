import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/lib/llm/router";

vi.mock("../../src/lib/llm/groq", () => ({ groqStrictJson: vi.fn() }));
vi.mock("../../src/lib/llm/gemini", () => ({ geminiGenerateJson: vi.fn() }));

import { groqStrictJson } from "../../src/lib/llm/groq";
import { geminiGenerateJson } from "../../src/lib/llm/gemini";
import { draftCore } from "../../src/lib/research/draft";

const mockGroqStrict = vi.mocked(groqStrictJson);
const mockGeminiJson = vi.mocked(geminiGenerateJson);

const TODAY = "2026-10-24";
const env: Env = {
  geminiApiKey: "g",
  geminiModelResearch: "gemini-flash-latest",
  geminiModelCheck: "gemini-flash-latest",
  groqApiKey: "k",
  groqBaseUrl: "https://api.groq.com/openai/v1",
  groqModelDraft: "openai/gpt-oss-120b",
  groqModelFast: "openai/gpt-oss-20b",
  customApiKey: "",
  customBaseUrl: "https://openrouter.ai/api/v1",
  customModel: "meta-llama/llama-3.3-70b-instruct",
  customFirst: false,
  customSearch: true,
  providerResearch: "gemini",
  providerCheck: "gemini",
};

const minimalCore = {
  facts: {
    partnerGated: { value: false, claim: null },
    securityAssessment: { value: false, claim: null },
    reviewRequired: { value: true, claim: { text: "x", findingIds: [], probeIds: [] } },
    customerAdminLikely: { value: null, claim: null },
    userCapBeforeApproval: { value: null, claim: null },
  },
  tierReason: { text: "x", findingIds: [], probeIds: [] },
  wait: null,
  scopeForks: [],
  managedApp: { exists: "unknown", claim: null, whatYouLose: [], whenToSwitch: [] },
  howItWorks: { flow: [], appTypes: [], tokenNotes: [] },
  scopes: [],
  prerequisites: [],
};

describe("draftCore", () => {
  beforeEach(() => {
    mockGroqStrict.mockReset();
    mockGeminiJson.mockReset();
  });

  it("returns the parsed DraftCore from Groq's strict mode", async () => {
    mockGroqStrict.mockResolvedValue({ text: JSON.stringify(minimalCore), totalTokens: 1 });
    const result = await draftCore(env, TODAY, "Example", { name: "Example", slug: "example", websiteUrl: null }, [], []);
    expect(result.tierReason.text).toBe("x");
    expect(mockGeminiJson).not.toHaveBeenCalled();
  });

  it("falls back to Gemini JSON mode when Groq fails", async () => {
    mockGroqStrict.mockRejectedValue(new Error("internal server error"));
    mockGeminiJson.mockResolvedValue({ text: JSON.stringify(minimalCore), totalTokens: 1 });
    const result = await draftCore(env, TODAY, "Example", { name: "Example", slug: "example", websiteUrl: null }, [], []);
    expect(result.tierReason.text).toBe("x");
    expect(mockGeminiJson).toHaveBeenCalledTimes(1);
  });

  it("falls back to Gemini when Groq's output fails schema validation", async () => {
    mockGroqStrict.mockResolvedValue({ text: JSON.stringify({ not: "valid" }), totalTokens: 1 });
    mockGeminiJson.mockResolvedValue({ text: JSON.stringify(minimalCore), totalTokens: 1 });
    const result = await draftCore(env, TODAY, "Example", { name: "Example", slug: "example", websiteUrl: null }, [], []);
    expect(result.tierReason.text).toBe("x");
  });

  it("throws when both providers fail", async () => {
    mockGroqStrict.mockRejectedValue(new Error("groq down"));
    mockGeminiJson.mockRejectedValue(new Error("gemini down"));
    await expect(
      draftCore(env, TODAY, "Example", { name: "Example", slug: "example", websiteUrl: null }, [], [])
    ).rejects.toThrow();
  }, 10000);
});
