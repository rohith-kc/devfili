import { z } from "zod";
import type { Env } from "../llm/router";
import { callWithRetry } from "../llm/router";
import { geminiGenerate } from "../llm/gemini";
import { groqComplete } from "../llm/groq";
import { parseJsonWithSchema } from "../llm/json";
import type { CheckResult } from "../schema";
import { checkPrompt, fallbackCheckPrompt } from "./prompts";

export interface ClaimForCheck {
  claimId: string;
  text: string;
  urls: string[];
  excerpts: string[];
}

const CheckResultsResponse = z.array(
  z.object({ claimId: z.string(), verdict: z.enum(["supported", "partial", "unsupported", "conflict"]), reason: z.string() })
);

const FallbackCheckResultsResponse = z.array(
  z.object({ claimId: z.string(), verdict: z.enum(["supported", "partial", "unsupported"]), reason: z.string() })
);

const MAX_CLAIMS = 40;
const MAX_DISTINCT_URLS_PER_CALL = 10;

/** Splits claims into batches that each touch at most 10 distinct URLs
 * (SPEC: "a second call only if more than 10 distinct URLs"). Assumes the
 * caller has already ordered claims by priority. */
function splitByDistinctUrls(claims: ClaimForCheck[]): ClaimForCheck[][] {
  const batches: ClaimForCheck[][] = [];
  let current: ClaimForCheck[] = [];
  let urls = new Set<string>();

  for (const claim of claims) {
    const newUrlCount = claim.urls.filter((u) => !urls.has(u)).length;
    if (current.length > 0 && urls.size + newUrlCount > MAX_DISTINCT_URLS_PER_CALL) {
      batches.push(current);
      current = [];
      urls = new Set();
    }
    current.push(claim);
    for (const u of claim.urls) urls.add(u);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function runGeminiCheck(env: Env, today: string, batch: ClaimForCheck[]): Promise<CheckResult[]> {
  const prompt = checkPrompt(today, JSON.stringify(batch.map((c) => ({ claimId: c.claimId, text: c.text, urls: c.urls }))));
  const result = await callWithRetry("check", "gemini", env.geminiModelCheck, () =>
    geminiGenerate({ apiKey: env.geminiApiKey, model: env.geminiModelCheck, prompt, tools: ["urlContext"] })
  );
  const parsed = parseJsonWithSchema(result.text, CheckResultsResponse);
  if (!parsed.success) throw new Error(`check: could not parse Gemini output: ${parsed.error}`);
  return parsed.data;
}

/** Excerpts-only fallback checker: no web access, weaker than the primary
 * check. Every result it produces is capped to supported/partial/unsupported
 * (never conflict, since it can't compare against the live page). */
async function runGroqFallbackCheck(env: Env, today: string, batch: ClaimForCheck[]): Promise<CheckResult[]> {
  const prompt = fallbackCheckPrompt(
    today,
    JSON.stringify(batch.map((c) => ({ claimId: c.claimId, text: c.text, excerpts: c.excerpts })))
  );
  const result = await callWithRetry("check-fallback", "groq", env.groqModelFast, () =>
    groqComplete({ apiKey: env.groqApiKey, baseURL: env.groqBaseUrl, model: env.groqModelFast, prompt, jsonMode: true })
  );
  const parsed = parseJsonWithSchema(result.text, FallbackCheckResultsResponse);
  if (!parsed.success) throw new Error(`check-fallback: could not parse Groq output: ${parsed.error}`);
  return parsed.data;
}

export interface CheckOutcome {
  results: CheckResult[];
  usedFallback: boolean;
}

/** Runs the independent fact-check stage over (at most) the 40 highest-
 * priority claims, batched by distinct URL count. Uses Gemini with
 * urlContext when env.providerCheck is 'gemini' (falling back to the
 * excerpts-only Groq checker if Gemini is unavailable); uses the Groq
 * checker directly when env.providerCheck is 'groq'. A batch that fails both
 * paths is left unresolved - the caller treats a missing claimId as not
 * checked. */
export async function runCheck(env: Env, today: string, allClaims: ClaimForCheck[]): Promise<CheckOutcome> {
  const claims = allClaims.slice(0, MAX_CLAIMS);
  if (claims.length === 0) return { results: [], usedFallback: false };

  const batches = splitByDistinctUrls(claims);
  const useGroqPrimary = env.providerCheck === "groq";
  let usedFallback = useGroqPrimary;
  const results: CheckResult[] = [];

  for (const batch of batches) {
    if (useGroqPrimary) {
      try {
        results.push(...(await runGroqFallbackCheck(env, today, batch)));
      } catch {
        // leave this batch's claims unresolved
      }
      continue;
    }
    try {
      results.push(...(await runGeminiCheck(env, today, batch)));
    } catch {
      usedFallback = true;
      try {
        results.push(...(await runGroqFallbackCheck(env, today, batch)));
      } catch {
        // leave this batch's claims unresolved
      }
    }
  }

  return { results, usedFallback };
}
