import { afterEach, describe, expect, it } from "vitest";
import { plainProviders } from "../../src/lib/llm/chain";
import { loadEnv, type Env } from "../../src/lib/llm/router";

const KEYS = ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "OPENROUTER_BASE_URL", "OPENROUTER_WEB_SEARCH", "OPENROUTER_MODEL", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_WEB_SEARCH", "PRIMARY_PROVIDER"];
const saved: Record<string, string | undefined> = {};
for (const k of KEYS) saved[k] = process.env[k];

function setEnv(values: Record<string, string>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("loadEnv provider selection", () => {
  it("uses OpenRouter first automatically when it is the only key", () => {
    setEnv({ OPENROUTER_API_KEY: "or-key" });
    expect(loadEnv().customFirst).toBe(true);
  });

  it("keeps Gemini/Groq first when their keys are set", () => {
    setEnv({ OPENROUTER_API_KEY: "or-key", GEMINI_API_KEY: "g", GROQ_API_KEY: "q" });
    expect(loadEnv().customFirst).toBe(false);
  });

  it("reads the neutral LLM_* names for any OpenAI-compatible endpoint", () => {
    setEnv({ LLM_API_KEY: "k", LLM_BASE_URL: "https://api.x.ai/v1", LLM_MODEL: "grok-x" });
    const env = loadEnv();
    expect(env.customApiKey).toBe("k");
    expect(env.customBaseUrl).toBe("https://api.x.ai/v1");
    expect(env.customModel).toBe("grok-x");
    expect(env.customFirst).toBe(true);
    expect(env.customSearch).toBe(false);
  });

  it("prefers LLM_* over the older OPENROUTER_* names", () => {
    setEnv({ LLM_API_KEY: "new", OPENROUTER_API_KEY: "old", LLM_MODEL: "m1", OPENROUTER_MODEL: "m2" });
    const env = loadEnv();
    expect(env.customApiKey).toBe("new");
    expect(env.customModel).toBe("m1");
  });

  it("lets PRIMARY_PROVIDER=openrouter override", () => {
    setEnv({ OPENROUTER_API_KEY: "or-key", GEMINI_API_KEY: "g", PRIMARY_PROVIDER: "custom" });
    expect(loadEnv().customFirst).toBe(true);
  });

  it("only enables :online web search on openrouter.ai unless forced", () => {
    setEnv({ OPENROUTER_API_KEY: "k", OPENROUTER_BASE_URL: "https://api.example.com/v1" });
    expect(loadEnv().customSearch).toBe(false);
    setEnv({ OPENROUTER_API_KEY: "k", OPENROUTER_BASE_URL: "https://api.example.com/v1", OPENROUTER_WEB_SEARCH: "on" });
    expect(loadEnv().customSearch).toBe(true);
    setEnv({ OPENROUTER_API_KEY: "k" });
    expect(loadEnv().customSearch).toBe(true);
  });
});

describe("plainProviders", () => {
  const base = { groqApiKey: "q", customApiKey: "o", customFirst: false } as Env;

  it("defaults to Groq then OpenRouter", () => {
    expect(plainProviders(base)).toEqual(["groq", "custom"]);
  });

  it("puts OpenRouter first when it is primary", () => {
    expect(plainProviders({ ...base, customFirst: true })).toEqual(["custom", "groq"]);
  });

  it("skips providers without a key", () => {
    expect(plainProviders({ ...base, groqApiKey: "" })).toEqual(["custom"]);
    expect(plainProviders({ ...base, customApiKey: "" })).toEqual(["groq"]);
  });
});
