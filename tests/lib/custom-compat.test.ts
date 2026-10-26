import { describe, expect, it } from "vitest";
import { adaptParams } from "../../src/lib/llm/custom";

const base = { model: "m", messages: [], max_tokens: 100, response_format: { type: "json_object" } };

describe("adaptParams (endpoint compatibility)", () => {
  it("switches to max_completion_tokens when the endpoint asks for it", () => {
    const next = adaptParams(base, new Error("400 Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."));
    expect(next).not.toBeNull();
    expect(next).toHaveProperty("max_completion_tokens", 100);
    expect(next).not.toHaveProperty("max_tokens");
  });

  it("drops response_format when the endpoint has no JSON mode", () => {
    const next = adaptParams(base, new Error("400 response_format json_object is not supported by this model"));
    expect(next).not.toHaveProperty("response_format");
    expect(next).toHaveProperty("max_tokens", 100);
  });

  it("gives up on errors it does not understand", () => {
    expect(adaptParams(base, new Error("401 invalid api key"))).toBeNull();
  });
});
