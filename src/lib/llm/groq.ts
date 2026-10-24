import OpenAI from "openai";

export interface GroqClientOptions {
  apiKey: string;
  baseURL: string;
}

export interface GroqCallResult {
  text: string;
  totalTokens: number | null;
}

function client(opts: GroqClientOptions): OpenAI {
  return new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
}

function toResult(completion: OpenAI.Chat.Completions.ChatCompletion): GroqCallResult {
  return {
    text: completion.choices[0]?.message?.content ?? "",
    totalTokens: completion.usage?.total_tokens ?? null,
  };
}

export interface GroqCompletionOptions extends GroqClientOptions {
  model: string;
  prompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
}

/** A plain (or JSON-object mode) chat completion. Throws on provider error -
 * the caller (router) is responsible for retry/fallback. */
export async function groqComplete(opts: GroqCompletionOptions): Promise<GroqCallResult> {
  const completion = await client(opts).chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: opts.prompt }],
    ...(opts.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  });
  return toResult(completion);
}

export interface GroqStrictJsonOptions extends GroqClientOptions {
  model: string;
  prompt: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}

/** Strict structured output (constrained decoding). Only works on
 * openai/gpt-oss-20b and openai/gpt-oss-120b; non-streaming only. */
export async function groqStrictJson(opts: GroqStrictJsonOptions): Promise<GroqCallResult> {
  const completion = await client(opts).chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: opts.prompt }],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.schemaName, strict: true, schema: opts.jsonSchema },
    },
  });
  return toResult(completion);
}

export interface GroqBrowserSearchOptions extends GroqClientOptions {
  model: string;
  prompt: string;
  maxCompletionTokens?: number;
}

/** The groq/compound replacement: the browser_search built-in tool on a
 * gpt-oss model. Not compatible with structured outputs. Capped output and
 * low reasoning effort keep each call's token use (input + output, which is
 * what free-tier daily limits count) well under budget. */
export async function groqBrowserSearch(opts: GroqBrowserSearchOptions): Promise<GroqCallResult> {
  const completion = await client(opts).chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: opts.prompt }],
    tool_choice: "required",
    tools: [{ type: "browser_search" }] as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
    reasoning_effort: "low",
    max_completion_tokens: opts.maxCompletionTokens ?? 8000,
  });
  return toResult(completion);
}
