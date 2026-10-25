import OpenAI from "openai";

export interface OpenRouterClientOptions {
  apiKey: string;
  baseURL: string;
}

export interface OpenRouterCallResult {
  text: string;
  totalTokens: number | null;
}

// Without an explicit timeout, a congested provider can leave a call hanging
// on the SDK's own default (minutes) instead of failing fast enough for
// callWithRetry to retry. OpenRouter is the last fallback tier, so this is a
// little more generous than Groq's - a :online web-search call genuinely
// takes longer than a plain completion.
const REQUEST_TIMEOUT_MS = 30000;

function client(opts: OpenRouterClientOptions): OpenAI {
  return new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    // Optional but recommended by OpenRouter for attribution; no secrets.
    defaultHeaders: {
      "HTTP-Referer": "https://devfili.app",
      "X-Title": "DevFili",
    },
  });
}

function toResult(completion: OpenAI.Chat.Completions.ChatCompletion): OpenRouterCallResult {
  return {
    text: completion.choices[0]?.message?.content ?? "",
    totalTokens: completion.usage?.total_tokens ?? null,
  };
}

export interface OpenRouterCompletionOptions extends OpenRouterClientOptions {
  model: string;
  prompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
}

/** A plain (or best-effort JSON-object mode) chat completion. Last-resort
 * fallback, used only after both Gemini and Groq have failed - throws on
 * provider error, same contract as groqComplete. */
export async function openrouterComplete(opts: OpenRouterCompletionOptions): Promise<OpenRouterCallResult> {
  const completion = await client(opts).chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: opts.prompt }],
    ...(opts.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  });
  return toResult(completion);
}

export interface OpenRouterWebSearchOptions extends OpenRouterClientOptions {
  model: string;
  prompt: string;
  maxTokens?: number;
}

/** Web-search fallback: appending ":online" to any OpenRouter model id
 * turns on OpenRouter's built-in web-search plugin (results woven into the
 * model's context before it answers) - the OpenRouter equivalent of Groq's
 * browser_search tool, used as the third and last research fallback. */
export async function openrouterWebSearch(opts: OpenRouterWebSearchOptions): Promise<OpenRouterCallResult> {
  const completion = await client(opts).chat.completions.create({
    model: `${opts.model}:online`,
    messages: [{ role: "user", content: opts.prompt }],
    max_tokens: opts.maxTokens ?? 3000,
  });
  return toResult(completion);
}
