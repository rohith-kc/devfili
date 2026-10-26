import { z } from "zod";
import type { Env } from "../llm/router";
import { callWithRetry } from "../llm/router";
import { groqStrictJson } from "../llm/groq";
import { geminiGenerateJson } from "../llm/gemini";
import { openrouterComplete } from "../llm/openrouter";
import { parseJsonWithSchema } from "../llm/json";
import { recheckFor } from "../evidence";
import { DraftCore, DraftPath, type Finding, type Probe } from "../schema";
import { draftCorePrompt, draftPathPrompt } from "./prompts";

function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

const DRAFT_CORE_JSON_SCHEMA = toStrictJsonSchema(DraftCore);
const DRAFT_PATH_JSON_SCHEMA = toStrictJsonSchema(DraftPath);

function findingsForPrompt(findings: Finding[], probes: Probe[]) {
  return findings.map((f) => ({
    id: f.id,
    topic: f.topic,
    statement: f.statement,
    sourceType: f.sourceType,
    publishedYear: f.publishedYear,
    recheck: recheckFor(f, probes),
  }));
}

function probesForPrompt(probes: Probe[]) {
  return probes.map((p) => ({ id: p.id, url: p.url, passed: p.readable && p.mustContainAll }));
}

/** Calls Groq's strict json_schema mode first; on total failure or a schema
 * mismatch, falls back to Gemini's own JSON mode with the schema spelled out
 * in the prompt (the draft stage's Gemini fallback from SPEC section 8), then
 * - if OpenRouter is configured - to OpenRouter's JSON-object mode with the
 * same schema-in-prompt approach, as the last resort. */
async function callStructured<T>(
  env: Env,
  stage: string,
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  zodSchema: z.ZodType<T>
): Promise<T> {
  const fallbackPrompt = `${prompt}\n\nReply with JSON ONLY, matching exactly this JSON Schema (every field is required; use null where the schema allows it):\n${JSON.stringify(jsonSchema)}`;

  let groqErr: unknown;
  try {
    const result = await callWithRetry(stage, "groq", env.groqModelDraft, () =>
      groqStrictJson({
        apiKey: env.groqApiKey,
        baseURL: env.groqBaseUrl,
        model: env.groqModelDraft,
        prompt,
        schemaName,
        jsonSchema,
      })
    );
    const parsed = parseJsonWithSchema(result.text, zodSchema);
    if (parsed.success) return parsed.data;
    groqErr = new Error(`groq output failed schema validation: ${parsed.error}`);
  } catch (err) {
    groqErr = err;
  }

  let geminiErr: unknown;
  try {
    const result = await callWithRetry(`${stage}-fallback`, "gemini", env.geminiModelResearch, () =>
      geminiGenerateJson({ apiKey: env.geminiApiKey, model: env.geminiModelResearch, prompt: fallbackPrompt })
    );
    const parsed = parseJsonWithSchema(result.text, zodSchema);
    if (parsed.success) return parsed.data;
    geminiErr = new Error(`gemini output failed schema validation: ${parsed.error}`);
  } catch (err) {
    geminiErr = err;
  }

  if (env.openrouterApiKey) {
    try {
      const result = await callWithRetry(`${stage}-fallback-2`, "openrouter", env.openrouterModel, () =>
        openrouterComplete({
          apiKey: env.openrouterApiKey,
          baseURL: env.openrouterBaseUrl,
          model: env.openrouterModel,
          prompt: fallbackPrompt,
          jsonMode: true,
        })
      );
      const parsed = parseJsonWithSchema(result.text, zodSchema);
      if (parsed.success) return parsed.data;
    } catch {
      // fall through to the combined error below
    }
  }

  throw new Error(
    `${stage}: all providers failed - groq: ${describeStageError(groqErr)}; gemini: ${describeStageError(geminiErr)}`
  );
}

function describeStageError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function draftCore(
  env: Env,
  today: string,
  appName: string,
  app: { name: string; slug: string; websiteUrl: string | null },
  findings: Finding[],
  probes: Probe[]
): Promise<DraftCore> {
  const prompt = draftCorePrompt(
    today,
    appName,
    JSON.stringify(app),
    JSON.stringify(findingsForPrompt(findings, probes)),
    JSON.stringify(probesForPrompt(probes))
  );
  return callStructured(env, "draft-core", prompt, "draft_core", DRAFT_CORE_JSON_SCHEMA, DraftCore);
}

export async function draftPath(
  env: Env,
  today: string,
  appName: string,
  app: { name: string; slug: string; websiteUrl: string | null },
  findings: Finding[],
  probes: Probe[],
  core: DraftCore | null
): Promise<DraftPath> {
  const coreSummary = core ? { facts: core.facts, scopes: core.scopes } : null;
  const prompt = draftPathPrompt(
    today,
    appName,
    JSON.stringify(app),
    JSON.stringify(findingsForPrompt(findings, probes)),
    JSON.stringify(probesForPrompt(probes)),
    JSON.stringify(coreSummary)
  );
  return callStructured(env, "draft-path", prompt, "draft_path", DRAFT_PATH_JSON_SCHEMA, DraftPath);
}
