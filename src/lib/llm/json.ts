import type { z } from "zod";

const FENCED_JSON = /```(?:json)?\s*([\s\S]*?)```/i;

/** Finds the first balanced {...} or [...] substring, respecting quoted
 * strings and escapes, ignoring any text before/after it. */
function extractFirstJsonValue(text: string): string | null {
  const startIdx = text.search(/[{[]/);
  if (startIdx === -1) return null;
  const openChar = text[startIdx];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

/** Parses the first fenced ```json block in `text`, or - failing that - the
 * first balanced top-level object/array found anywhere in it. Returns null
 * rather than throwing when nothing parseable is found. */
export function extractJson(text: string): unknown | null {
  const fencedMatch = text.match(FENCED_JSON);
  const candidate = fencedMatch ? fencedMatch[1] : text;

  try {
    return JSON.parse(candidate.trim());
  } catch {
    // fall through to bracket extraction
  }

  const extracted = extractFirstJsonValue(candidate) ?? extractFirstJsonValue(text);
  if (extracted === null) return null;
  try {
    return JSON.parse(extracted);
  } catch {
    return null;
  }
}

export type ParseResult<T> = { success: true; data: T } | { success: false; error: string };

/** Extracts JSON from model output text and validates it against `schema`. */
export function parseJsonWithSchema<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  const raw = extractJson(text);
  if (raw === null) return { success: false, error: "no JSON found in model output" };
  const result = schema.safeParse(raw);
  if (!result.success) return { success: false, error: result.error.message };
  return { success: true, data: result.data };
}
