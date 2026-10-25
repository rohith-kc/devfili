import { z } from "zod";
import type { Env } from "../llm/router";
import { callWithRetry } from "../llm/router";
import { geminiGenerate } from "../llm/gemini";
import { groqBrowserSearch, groqComplete } from "../llm/groq";
import { openrouterWebSearch } from "../llm/openrouter";
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
  const prompt = `The following text should contain one JSON object of the shape {"findings":[...],"notFound":[...]} but failed to parse as-is. Extract it and fix any formatting problems. Reply with ONLY the corrected JSON object, no commentary.\n\n${badText.slice(0, 8000)}`;
  try {
    const result = await callWithRetry(`${stage}-repair`, "groq", env.groqModelFast, () =>
      groqComplete({ apiKey: env.groqApiKey, baseURL: env.groqBaseUrl, model: env.groqModelFast, prompt, jsonMode: true })
    );
    const parsed = parseJsonWithSchema(result.text, RawFindingsResponse);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Runs the primary provider call (with its own internal retry); on total
 * failure of a Gemini call, falls back once to Groq's browser_search tool
 * (groq/compound's replacement), then once more to OpenRouter's web-search
 * plugin (when configured) if Groq also fails. On a JSON parse failure,
 * makes one repair call. Never throws - returns no findings on total
 * failure so one broken source doesn't sink the whole stage. */
async function tryOpenRouterDiscover(env: Env, stage: string, prompt: string): Promise<string | null> {
  if (!env.openrouterApiKey) return null;
  try {
    const result = await callWithRetry(`${stage}-fallback-2`, "openrouter", env.openrouterModel, () =>
      openrouterWebSearch({ apiKey: env.openrouterApiKey, baseURL: env.openrouterBaseUrl, model: env.openrouterModel, prompt })
    );
    return result.text;
  } catch {
    return null;
  }
}

async function discoverOneSide(env: Env, stage: string, prompt: string, useGroq: boolean): Promise<RawFindingsResponse> {
  let text: string | null = null;
  try {
    const result = useGroq
      ? await callWithRetry(stage, "groq", env.groqModelFast, () =>
          groqBrowserSearch({ apiKey: env.groqApiKey, baseURL: env.groqBaseUrl, model: env.groqModelFast, prompt })
        )
      : await callWithRetry(stage, "gemini", env.geminiModelResearch, () =>
          geminiGenerate({
            apiKey: env.geminiApiKey,
            model: env.geminiModelResearch,
            prompt,
            tools: ["googleSearch", "urlContext"],
          })
        );
    text = result.text;
  } catch {
    if (useGroq) {
      // Primary was already Groq's browser_search - the next fallback tier
      // is OpenRouter, not another identical (and equally expensive) Groq call.
      text = await tryOpenRouterDiscover(env, stage, prompt);
    } else {
      try {
        const fallback = await callWithRetry(`${stage}-fallback`, "groq", env.groqModelFast, () =>
          groqBrowserSearch({ apiKey: env.groqApiKey, baseURL: env.groqBaseUrl, model: env.groqModelFast, prompt })
        );
        text = fallback.text;
      } catch {
        text = await tryOpenRouterDiscover(env, stage, prompt);
      }
    }
    if (text === null) return { findings: [], notFound: [`${stage}: provider call failed`] };
  }

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
    discoverOneSide(env, "discover-official", officialPrompt, useGroq).catch(() => EMPTY),
    discoverOneSide(env, "discover-community", communityPrompt, useGroq).catch(() => EMPTY),
  ]);

  const findings = dedupeAndAssignIds([...official.findings, ...community.findings]);
  const notFound = [...official.notFound, ...community.notFound];
  return { findings, notFound };
}
