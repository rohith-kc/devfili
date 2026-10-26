import { afterEach, describe, expect, it } from "vitest";
import { plainProviders } from "../../src/lib/llm/chain";
import { loadEnv, type Env } from "../../src/lib/llm/router";

const KEYS = ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "PRIMARY_PROVIDER", "OPENROUTER_BASE_URL", "OPENROUTER_WEB_SEARCH"];
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
    expect(loadEnv().openrouterFirst).toBe(true);
  });

  it("keeps Gemini/Groq first when their keys are set", () => {
    setEnv({ OPENROUTER_API_KEY: "or-key", GEMINI_API_KEY: "g", GROQ_API_KEY: "q" });
    expect(loadEnv().openrouterFirst).toBe(false);
  });

  it("lets PRIMARY_PROVIDER=openrouter override", () => {
    setEnv({ OPENROUTER_API_KEY: "or-key", GEMINI_API_KEY: "g", PRIMARY_PROVIDER: "openrouter" });
    expect(loadEnv().openrouterFirst).toBe(true);
  });

  it("only enables :online web search on openrouter.ai unless forced", () => {
    setEnv({ OPENROUTER_API_KEY: "k", OPENROUTER_BASE_URL: "https://api.example.com/v1" });
    expect(loadEnv().openrouterWebSearch).toBe(false);
    setEnv({ OPENROUTER_API_KEY: "k", OPENROUTER_BASE_URL: "https://api.example.com/v1", OPENROUTER_WEB_SEARCH: "on" });
    expect(loadEnv().openrouterWebSearch).toBe(true);
    setEnv({ OPENROUTER_API_KEY: "k" });
    expect(loadEnv().openrouterWebSearch).toBe(true);
  });
});

describe("plainProviders", () => {
  const base = { groqApiKey: "q", openrouterApiKey: "o", openrouterFirst: false } as Env;

  it("defaults to Groq then OpenRouter", () => {
    expect(plainProviders(base)).toEqual(["groq", "openrouter"]);
  });

  it("puts OpenRouter first when it is primary", () => {
    expect(plainProviders({ ...base, openrouterFirst: true })).toEqual(["openrouter", "groq"]);
  });

  it("skips providers without a key", () => {
    expect(plainProviders({ ...base, groqApiKey: "" })).toEqual(["openrouter"]);
    expect(plainProviders({ ...base, openrouterApiKey: "" })).toEqual(["groq"]);
  });
});
