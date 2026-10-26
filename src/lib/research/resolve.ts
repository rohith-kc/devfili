import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Env } from "../llm/router";
import { plainComplete } from "../llm/chain";
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
  const { text } = await plainComplete(env, "resolve", prompt, { jsonMode: true });

  const parsed = parseJsonWithSchema(text, ResolveResponse);
  if (!parsed.success) {
    return { type: "not_found", note: "Could not understand the app you meant. Try naming it more specifically." };
  }

  const data = parsed.data;
  if (data.status === "ambiguous") {
    return { type: "ambiguous", candidates: data.candidates, note: data.note };
  }
  if (data.status === "not_found" || !data.app) {
    return { type: "not_found", note: data.note || "Could not identify this product." };
  }
  const slug = data.app.slug || slugify(data.app.name);
  return { type: "app", app: { name: data.app.name, slug, websiteUrl: data.app.websiteUrl } };
}
