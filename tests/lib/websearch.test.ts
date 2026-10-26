import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiSearchLinks, configuredSearchProvider } from "../../src/lib/research/websearch";

const original = { provider: process.env.SEARCH_PROVIDER, key: process.env.SEARCH_API_KEY };

function mockFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("apiSearchLinks", () => {
  beforeEach(() => {
    process.env.SEARCH_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (original.provider === undefined) delete process.env.SEARCH_PROVIDER; else process.env.SEARCH_PROVIDER = original.provider;
    if (original.key === undefined) delete process.env.SEARCH_API_KEY; else process.env.SEARCH_API_KEY = original.key;
  });

  it("is off without a provider and key", () => {
    delete process.env.SEARCH_PROVIDER;
    expect(configuredSearchProvider()).toBeNull();
    process.env.SEARCH_PROVIDER = "bing";
    expect(configuredSearchProvider()).toBeNull();
  });

  it("reads Tavily results", async () => {
    process.env.SEARCH_PROVIDER = "tavily";
    const fn = mockFetch({ results: [{ url: "https://a.com/x" }, { url: "not a url" }, { url: "https://b.com/y" }] });
    expect(await apiSearchLinks("fireflies oauth")).toEqual(["https://a.com/x", "https://b.com/y"]);
    expect(fn.mock.calls[0][0]).toBe("https://api.tavily.com/search");
  });

  it("reads Brave results", async () => {
    process.env.SEARCH_PROVIDER = "brave";
    mockFetch({ web: { results: [{ url: "https://a.com" }] } });
    expect(await apiSearchLinks("q")).toEqual(["https://a.com"]);
  });

  it("reads Serper results", async () => {
    process.env.SEARCH_PROVIDER = "serper";
    mockFetch({ organic: [{ link: "https://a.com" }, { link: "https://b.com" }] });
    expect(await apiSearchLinks("q", 1)).toEqual(["https://a.com"]);
  });

  it("returns nothing, without throwing, when the provider errors", async () => {
    process.env.SEARCH_PROVIDER = "tavily";
    mockFetch({}, false);
    expect(await apiSearchLinks("q")).toEqual([]);
  });
});
