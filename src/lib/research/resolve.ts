import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Env } from "../llm/router";
import { plainComplete } from "../llm/chain";
import { searchText } from "./discover";
import { parseJsonWithSchema } from "../llm/json";
import { normalizeQuery, slugify } from "../normalize";
import { resolvePrompt } from "./prompts";

export interface AppInfo {
  name: string;
  slug: string;
  websiteUrl: string | null;
}

export interface AppsEntry {
  slug: string;
  name: string;
  websiteUrl: string;
  aliases: string[];
  order: number;
}

export type ResolveResult =
  | { type: "library"; slug: string }
  | { type: "app"; app: AppInfo }
  | { type: "ambiguous"; candidates: { name: string; websiteUrl: string | null; description: string }[]; note: string }
  | { type: "not_found"; note: string };

const ResolveResponse = z.object({
  status: z.enum(["ok", "ambiguous", "not_found"]),
  app: z.object({ name: z.string(), slug: z.string(), websiteUrl: z.string().nullable() }).nullable(),
  candidates: z.array(z.object({ name: z.string(), websiteUrl: z.string().nullable(), description: z.string() })),
  note: z.string(),
});

let cachedApps: AppsEntry[] | null = null;

export function loadApps(): AppsEntry[] {
  if (cachedApps) return cachedApps;
  const file = path.join(process.cwd(), "content", "apps.json");
  cachedApps = JSON.parse(fs.readFileSync(file, "utf8")) as AppsEntry[];
  return cachedApps;
}

export function findLibraryMatch(query: string, apps: AppsEntry[] = loadApps()): string | null {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;
  for (const app of apps) {
    if (app.slug === normalized) return app.slug;
    if (app.aliases.some((alias) => normalizeQuery(alias) === normalized)) return app.slug;
  }
  return null;
}

/** No model call for a library match. Otherwise a single Groq FAST,
 * JSON-object-mode call to disambiguate the query into a product, falling
 * back once to OpenRouter (when configured) if Groq is unavailable. */
export async function resolveApp(query: string, env: Env, today: string): Promise<ResolveResult> {
  const libraryMatch = findLibraryMatch(query);
  if (libraryMatch) return { type: "library", slug: libraryMatch };

  const prompt = resolvePrompt(today, query);
  const firstText = await plainComplete(env, "resolve", prompt, { jsonMode: true }).then((r) => r.text, () => null);
  const first = tryResolve(firstText);
  if (first && first.type !== "not_found") return first;

  // The quick call answers from memory and does not know newer products
  // (it said "not found" for Fireflies.ai, for example). Look the name up on
  // the web before giving up.
  const searchPrompt = `${prompt}
You may use web search. Many real products are newer than your training data, so do NOT answer "not_found" just because you do not recognise the name: search for it first. Answer "not_found" only if a search finds no such software product.`;
  // Search answers sometimes come back as prose instead of the JSON asked for, so allow one more try.
  let gotAnyAnswer = firstText !== null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await searchText(env, "resolve-search", searchPrompt, query, "");
    if (text !== null) gotAnyAnswer = true;
    const searched = tryResolve(text);
    if (searched) return searched;
  }

  // Every provider call failed (for example a quota limit): that is "busy", not "no such app".
  if (!gotAnyAnswer) throw new Error("resolve: no provider answered");

  return (
    first ?? {
      type: "not_found",
      note: "Could not identify that app. Try its full name or its website address (for example fireflies.ai).",
    }
  );
}

function tryResolve(text: string | null): ResolveResult | null {
  if (!text) return null;
  const parsed = parseJsonWithSchema(text, ResolveResponse);
  if (!parsed.success) return null;
  const data = parsed.data;
  if (data.status === "ambiguous") return { type: "ambiguous", candidates: data.candidates, note: data.note };
  if (data.status === "not_found" || !data.app) {
    return { type: "not_found", note: data.note || "Could not identify this product." };
  }
  const slug = data.app.slug || slugify(data.app.name);
  return { type: "app", app: { name: data.app.name, slug, websiteUrl: data.app.websiteUrl } };
}
