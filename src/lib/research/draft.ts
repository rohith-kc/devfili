import { z } from "zod";
import type { Env } from "../llm/router";
import { callWithRetry } from "../llm/router";
import { groqStrictJson } from "../llm/groq";
import { geminiGenerateJson } from "../llm/gemini";
import { customComplete } from "../llm/custom";
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

/** Tries each configured provider until one returns valid JSON for the schema:
 * Groq's strict json_schema mode, then Gemini's JSON mode, then OpenRouter's
 * JSON-object mode (the last two with the schema spelled out in the prompt).
 * OpenRouter goes first when it is the configured primary. */
async function callStructured<T>(
  env: Env,
  stage: string,
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  zodSchema: z.ZodType<T>
): Promise<T> {
  const fallbackPrompt = `${prompt}\n\nReply with JSON ONLY, matching exactly this JSON Schema (every field is required; use null where the schema allows it):\n${JSON.stringify(jsonSchema)}`;

  type Attempt = { provider: "groq" | "gemini" | "custom"; run: () => Promise<{ text: string }> };
  const attempts: Attempt[] = [];
  if (env.groqApiKey) {
    attempts.push({
      provider: "groq",
      run: () =>
        callWithRetry(stage, "groq", env.groqModelDraft, () =>
          groqStrictJson({ apiKey: env.groqApiKey, baseURL: env.groqBaseUrl, model: env.groqModelDraft, prompt, schemaName, jsonSchema })
        ),
    });
  }
  if (env.geminiApiKey) {
    attempts.push({
      provider: "gemini",
      run: () =>
        callWithRetry(`${stage}-fallback`, "gemini", env.geminiModelResearch, () =>
          geminiGenerateJson({ apiKey: env.geminiApiKey, model: env.geminiModelResearch, prompt: fallbackPrompt })
        ),
    });
  }
  if (env.customApiKey) {
    const custom: Attempt = {
      provider: "custom",
      run: () =>
        callWithRetry(`${stage}-fallback-2`, "custom", env.customModel, () =>
          customComplete({
            apiKey: env.customApiKey,
            baseURL: env.customBaseUrl,
            model: env.customModel,
            prompt: fallbackPrompt,
            jsonMode: true,
            maxTokens: 8000,
          })
        ),
    };
    if (env.customFirst) attempts.unshift(custom);
    else attempts.push(custom);
  }
  if (attempts.length === 0) throw new Error(`${stage}: no provider key is configured`);

  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = await attempt.run();
      const parsed = parseJsonWithSchema(result.text, zodSchema);
      if (parsed.success) return parsed.data;
      failures.push(`${attempt.provider}: output failed schema validation: ${parsed.error}`);
    } catch (err) {
      failures.push(`${attempt.provider}: ${describeStageError(err)}`);
    }
  }
  throw new Error(`${stage}: all providers failed - ${failures.join("; ")}`);
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
