import { z } from "zod";
import type { Env } from "../llm/router";
import { callWithRetry } from "../llm/router";
import { geminiGenerate } from "../llm/gemini";
import { groqBrowserSearch } from "../llm/groq";
import { plainComplete } from "../llm/chain";
import { customSearchComplete } from "../llm/custom";
import { gatherSources, sourcesBlock } from "./retrieve";
import { parseJsonWithSchema } from "../llm/json";
import type { Finding } from "../schema";
import { communityResearchPrompt, officialResearchPrompt } from "./prompts";

const RawFinding = z.object({
  topic: z.string(),
  statement: z.string(),
  sourceUrl: z.string(),
  sourceTitle: z.string(),
  sourceType: z.enum(["official", "community", "vendor"]),
  publishedYear: z.number().int().nullable(),
  excerpt: z.string(),
  checkable: z.object({ url: z.string(), mustContain: z.array(z.string()) }).nullable(),
});
type RawFinding = z.infer<typeof RawFinding>;

const RawFindingsResponse = z.object({
  findings: z.array(RawFinding),
  notFound: z.array(z.string()),
});
type RawFindingsResponse = z.infer<typeof RawFindingsResponse>;

const MAX_FINDINGS = 60;
const EMPTY: RawFindingsResponse = { findings: [], notFound: [] };

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function repairJson(env: Env, stage: string, badText: string): Promise<RawFindingsResponse | null> {
  const prompt = `The following text should contain one JSON object of the shape {"findings":[...],"notFound":[...]} but failed to parse as-is. Extract it and fix any formatting problems. Reply with ONLY the corrected JSON object, no commentary.

${badText.slice(0, 8000)}`;
  try {
    const result = await plainComplete(env, `${stage}-repair`, prompt, { jsonMode: true });
    const parsed = parseJsonWithSchema(result.text, RawFindingsResponse);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type SearchProvider = "gemini" | "groq" | "custom";

/** Which providers to try for a web-search call, best first. Providers
 * without a key are skipped. Default order is the configured primary
 * (Gemini, or Groq's browser_search), then the other, then OpenRouter; when
 * OpenRouter is the configured primary it goes first. */
function searchOrder(env: Env, useGroq: boolean): SearchProvider[] {
  const base: SearchProvider[] = useGroq ? ["groq", "custom"] : ["gemini", "groq", "custom"];
  const ordered: SearchProvider[] = env.customFirst ? ["custom", ...base.filter((p) => p !== "custom")] : base;
  return ordered.filter((p) => (p === "gemini" ? !!env.geminiApiKey : p === "groq" ? !!env.groqApiKey : !!env.customApiKey));
}

function runSearch(env: Env, provider: SearchProvider, stage: string, prompt: string, attemptIndex: number, appName: string, website: string) {
  const label = attemptIndex === 0 ? stage : `${stage}-fallback${attemptIndex > 1 ? `-${attemptIndex}` : ""}`;
  if (provider === "gemini") {
    return callWithRetry(label, "gemini", env.geminiModelResearch, () =>
      geminiGenerate({ apiKey: env.geminiApiKey, model: env.geminiModelResearch, prompt, tools: ["googleSearch", "urlContext"] })
    );
  }
  if (provider === "groq") {
    return callWithRetry(label, "groq", env.groqModelFast, () =>
      groqBrowserSearch({ apiKey: env.groqApiKey, baseURL: env.groqBaseUrl, model: env.groqModelFast, prompt })
    );
  }
  return runCustomSearch(env, label, stage, prompt, appName, website);
}

async function runCustomSearch(env: Env, label: string, stage: string, prompt: string, appName: string, website: string) {
  // No built-in search on this endpoint: fetch the public pages once (not again on a retry) and let the model read them.
  const fullPrompt = env.customSearch
    ? prompt
    : prompt + sourcesBlock(await gatherSources(stage.includes("resolve") ? "identify" : stage.includes("community") ? "community" : "official", appName, website));
  return callWithRetry(label, "custom", env.customModel, () =>
    customSearchComplete({
      apiKey: env.customApiKey,
      baseURL: env.customBaseUrl,
      model: env.customModel,
      prompt: fullPrompt,
      online: env.customSearch,
    })
  );
}

/** One web-search-capable call through the first provider that works (used to
 * identify a product the plain model does not recognise). Returns null on total failure. */
export async function searchText(env: Env, stage: string, prompt: string, appName: string, website: string): Promise<string | null> {
  const order = searchOrder(env, false);
  for (let i = 0; i < order.length; i++) {
    try {
      return (await runSearch(env, order[i], stage, prompt, i, appName, website)).text;
    } catch {
      // try the next provider
    }
  }
  return null;
}

/** Runs the web-search call through each available provider in turn until
 * one answers. On a JSON parse failure, makes one repair call. Never throws -
 * returns no findings on total failure so one broken source doesn't sink the
 * whole stage. */
async function discoverOneSide(env: Env, stage: string, prompt: string, useGroq: boolean, appName: string, website: string): Promise<RawFindingsResponse> {
  let text: string | null = null;
  const order = searchOrder(env, useGroq);
  for (let i = 0; i < order.length && text === null; i++) {
    try {
      text = (await runSearch(env, order[i], stage, prompt, i, appName, website)).text;
    } catch {
      // try the next provider
    }
  }
  if (text === null) return { findings: [], notFound: [`${stage}: provider call failed`] };

  const parsed = parseJsonWithSchema(text, RawFindingsResponse);
  if (parsed.success) return parsed.data;

  console.log(`[research] stage=${stage} parse-failed reason=${parsed.error} snippet=${JSON.stringify(text.slice(0, 300))}`);
  const repaired = await repairJson(env, stage, text);
  if (repaired && repaired.findings.length === 0) {
    console.log(`[research] stage=${stage} repaired-but-empty notFound=${JSON.stringify(repaired.notFound)}`);
  }
  return repaired ?? { findings: [], notFound: [`${stage}: could not parse model output`] };
}

function dedupeAndAssignIds(raw: RawFinding[]): Finding[] {
  const seen = new Set<string>();
  const findings: Finding[] = [];
  let n = 1;
  for (const f of raw) {
    if (!isValidUrl(f.sourceUrl)) continue;
    if (f.checkable && !isValidUrl(f.checkable.url)) continue;
    const key = `${f.sourceUrl}::${f.statement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ ...f, id: `F${n++}` });
    if (findings.length >= MAX_FINDINGS) break;
  }
  return findings;
}

export interface DiscoverResult {
  findings: Finding[];
  notFound: string[];
}

/** Two research calls run in parallel: official sources and community
 * reports. Uses Gemini with googleSearch+urlContext when
 * env.providerResearch is 'gemini' (falling back to Groq's browser_search
 * tool if Gemini fails twice); uses browser_search directly when
 * env.providerResearch is 'groq'. */
export async function discover(env: Env, appName: string, website: string, today: string): Promise<DiscoverResult> {
  const officialPrompt = officialResearchPrompt(today, appName, website);
  const communityPrompt = communityResearchPrompt(today, appName, website);
  const useGroq = env.providerResearch === "groq";

  const [official, community] = await Promise.all([
    discoverOneSide(env, "discover-official", officialPrompt, useGroq, appName, website).catch(() => EMPTY),
    discoverOneSide(env, "discover-community", communityPrompt, useGroq, appName, website).catch(() => EMPTY),
  ]);

  const findings = dedupeAndAssignIds([...official.findings, ...community.findings]);
  const notFound = [...official.notFound, ...community.notFound];
  return { findings, notFound };
}
