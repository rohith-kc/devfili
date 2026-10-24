import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJson, parseJsonWithSchema } from "../../src/lib/llm/json";

describe("extractJson", () => {
  it("parses a fenced json block", () => {
    expect(extractJson('Here you go:\n```json\n{"a": 1}\n```\nThanks')).toEqual({ a: 1 });
  });

  it("parses a plain fence with no json label", () => {
    expect(extractJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("parses raw JSON with no fence", () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("extracts the first balanced object from surrounding prose", () => {
    expect(extractJson('Sure, here is the result: {"a": 1, "b": [1,2,3]} - let me know if you need more.')).toEqual({
      a: 1,
      b: [1, 2, 3],
    });
  });

  it("extracts a top-level array", () => {
    expect(extractJson("Findings: [1, 2, 3] end")).toEqual([1, 2, 3]);
  });

  it("handles braces inside quoted strings without miscounting depth", () => {
    expect(extractJson('{"text": "a { weird } string"}')).toEqual({ text: "a { weird } string" });
  });

  it("returns null when there is no JSON at all", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("parseJsonWithSchema", () => {
  const schema = z.object({ a: z.number() });

  it("succeeds when the extracted JSON matches the schema", () => {
    const result = parseJsonWithSchema('```json\n{"a": 1}\n```', schema);
    expect(result).toEqual({ success: true, data: { a: 1 } });
  });

  it("fails with a reason when nothing parses", () => {
    const result = parseJsonWithSchema("nothing here", schema);
    expect(result.success).toBe(false);
  });

  it("fails when the JSON doesn't match the schema", () => {
    const result = parseJsonWithSchema('{"a": "not a number"}', schema);
    expect(result.success).toBe(false);
  });
});
