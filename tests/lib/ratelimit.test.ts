import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/supabase/admin", () => ({ getAdminClient: () => null }));

import { checkHelperRunLimit, checkLiveRunLimit, ownLimitsDisabled, resetMemoryLimitsForTests } from "../../src/lib/safety/ratelimit";

describe("live run limit without a database", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMITS", "");
    resetMemoryLimitsForTests();
    process.env.LIVE_RUNS_PER_GUEST_PER_DAY = "3";
    process.env.LIVE_RUNS_GLOBAL_PER_DAY = "100";
  });

  it("allows the configured number of runs per visitor, then blocks", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await checkLiveRunLimit({ ip: "1.2.3.4" })).allowed);
    expect(results).toEqual([true, true, true, false]);
  });

  it("counts each visitor separately", async () => {
    for (let i = 0; i < 3; i++) await checkLiveRunLimit({ ip: "1.2.3.4" });
    expect((await checkLiveRunLimit({ ip: "5.6.7.8" })).allowed).toBe(true);
  });

  it("stops everyone once the global ceiling is reached", async () => {
    process.env.LIVE_RUNS_GLOBAL_PER_DAY = "2";
    await checkLiveRunLimit({ ip: "a" });
    await checkLiveRunLimit({ ip: "b" });
    expect((await checkLiveRunLimit({ ip: "c" })).allowed).toBe(false);
  });
});

describe("switching DevFili's own limits off", () => {
  beforeEach(() => {
    resetMemoryLimitsForTests();
    process.env.LIVE_RUNS_PER_GUEST_PER_DAY = "1";
    vi.stubEnv("RATE_LIMITS", "");
  });

  it("is on in production by default and off while running locally", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(ownLimitsDisabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(ownLimitsDisabled()).toBe(true);
  });

  it("RATE_LIMITS=off removes the caps, RATE_LIMITS=on forces them back", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMITS", "off");
    for (let i = 0; i < 5; i++) expect((await checkLiveRunLimit({ ip: "9.9.9.9" })).allowed).toBe(true);
    expect((await checkHelperRunLimit({ ip: "9.9.9.9" })).allowed).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RATE_LIMITS", "on");
    expect(ownLimitsDisabled()).toBe(false);
  });
});
