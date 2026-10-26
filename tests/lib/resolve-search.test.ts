import { beforeEach, describe, expect, it, vi } from "vitest";

const plainComplete = vi.fn();
const searchText = vi.fn();

vi.mock("../../src/lib/llm/chain", () => ({ plainComplete: (...a: unknown[]) => plainComplete(...a) }));
vi.mock("../../src/lib/research/discover", () => ({ searchText: (...a: unknown[]) => searchText(...a) }));

import { resolveApp } from "../../src/lib/research/resolve";
import type { Env } from "../../src/lib/llm/router";

const env = {} as Env;
const found = JSON.stringify({
  status: "ok",
  app: { name: "Fireflies.ai", slug: "fireflies", websiteUrl: "https://fireflies.ai" },
  candidates: [],
  note: "",
});
const notFound = JSON.stringify({ status: "not_found", app: null, candidates: [], note: "unknown product" });

describe("resolveApp web-search second chance", () => {
  beforeEach(() => {
    plainComplete.mockReset();
    searchText.mockReset();
  });

  it("does not search when the quick answer already identifies the app", async () => {
    plainComplete.mockResolvedValue({ text: found });
    const result = await resolveApp("fireflies", env, "2026-10-26");
    expect(result.type).toBe("app");
    expect(searchText).not.toHaveBeenCalled();
  });

  it("searches the web when the quick answer says not found, and uses that answer", async () => {
    plainComplete.mockResolvedValue({ text: notFound });
    searchText.mockResolvedValue(found);
    const result = await resolveApp("fireflies", env, "2026-10-26");
    expect(result).toEqual({ type: "app", app: { name: "Fireflies.ai", slug: "fireflies", websiteUrl: "https://fireflies.ai" } });
    expect(searchText).toHaveBeenCalledTimes(1);
  });

  it("still reports not found when the search also finds nothing", async () => {
    plainComplete.mockResolvedValue({ text: notFound });
    searchText.mockResolvedValue(null);
    const result = await resolveApp("zzzz", env, "2026-10-26");
    expect(result.type).toBe("not_found");
  });

  it("searches when the quick call fails outright", async () => {
    plainComplete.mockRejectedValue(new Error("provider down"));
    searchText.mockResolvedValue(found);
    expect((await resolveApp("fireflies", env, "2026-10-26")).type).toBe("app");
  });

  it('reports a provider problem, not "not found", when every call fails', async () => {
    plainComplete.mockRejectedValue(new Error("429 rate limited"));
    searchText.mockResolvedValue(null);
    await expect(resolveApp("fireflies", env, "2026-10-26")).rejects.toThrow();
  });
});
