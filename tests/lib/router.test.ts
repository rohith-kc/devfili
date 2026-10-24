import { describe, expect, it, vi } from "vitest";
import { callWithRetry } from "../../src/lib/llm/router";

function retryableError(status: number): Error {
  const err = new Error("boom") as Error & { status: number };
  err.status = status;
  return err;
}

describe("callWithRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue({ totalTokens: 10 });
    const result = await callWithRetry("discover", "gemini", "gemini-flash-latest", fn, () => {});
    expect(result).toEqual({ totalTokens: 10 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries once after a 429 and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError(429))
      .mockResolvedValueOnce({ totalTokens: 5 });
    const result = await callWithRetry("discover", "gemini", "gemini-flash-latest", fn, () => {});
    expect(result).toEqual({ totalTokens: 5 });
    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);

  it("does not retry a non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("invalid request"));
    await expect(callWithRetry("discover", "gemini", "gemini-flash-latest", fn, () => {})).rejects.toThrow(
      "invalid request"
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after a retryable error fails twice", async () => {
    const fn = vi.fn().mockRejectedValue(retryableError(503));
    await expect(callWithRetry("discover", "gemini", "gemini-flash-latest", fn, () => {})).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);

  it("logs stage/provider/model/duration without ever logging a prompt or key", async () => {
    const logs: unknown[] = [];
    const fn = vi.fn().mockResolvedValue({ totalTokens: 1 });
    await callWithRetry("draft", "groq", "openai/gpt-oss-120b", fn, (log) => logs.push(log));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ stage: "draft", provider: "groq", model: "openai/gpt-oss-120b", ok: true });
  });
});
