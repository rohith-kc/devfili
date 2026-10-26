import OpenAI from "openai";

export interface CustomClientOptions {
  apiKey: string;
  baseURL: string;
}

export interface CustomCallResult {
  text: string;
  totalTokens: number | null;
}

// Without an explicit timeout, a congested provider can leave a call hanging
// on the SDK's own default (minutes) instead of failing fast enough for
// callWithRetry to retry. OpenRouter is the last fallback tier, so this is a
// little more generous than Groq's - a :online web-search call genuinely
// takes longer than a plain completion.
const REQUEST_TIMEOUT_MS = 60000;

function client(opts: CustomClientOptions): OpenAI {
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

function toResult(completion: OpenAI.Chat.Completions.ChatCompletion): CustomCallResult {
  return {
    text: completion.choices[0]?.message?.content ?? "",
    totalTokens: completion.usage?.total_tokens ?? null,
  };
}

export interface CustomCompletionOptions extends CustomClientOptions {
  model: string;
  prompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
}

/** A plain (or best-effort JSON-object mode) chat completion. Last-resort
 * fallback, used only after both Gemini and Groq have failed - throws on
 * provider error, same contract as groqComplete. */
export async function customComplete(opts: CustomCompletionOptions): Promise<CustomCallResult> {
  const completion = await client(opts).chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: opts.prompt }],
    ...(opts.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  });
  return toResult(completion);
}

export interface CustomSearchOptions extends CustomClientOptions {
  model: string;
  /** Append ":online" (OpenRouter only). Other endpoints answer from the pages in the prompt. */
  online?: boolean;
  prompt: string;
  maxTokens?: number;
}

/** Research call on the custom endpoint. With online=true, appends ":online" to the model id on OpenRouter
 * turns on OpenRouter's built-in web-search plugin (results woven into the
 * model's context before it answers) - the OpenRouter equivalent of Groq's
 * browser_search tool, used as the third and last research fallback. */
export async function customSearchComplete(opts: CustomSearchOptions): Promise<CustomCallResult> {
  const completion = await client(opts).chat.completions.create({
    model: opts.online === false ? opts.model : `${opts.model}:online`,
    messages: [{ role: "user", content: opts.prompt }],
    max_tokens: opts.maxTokens ?? 6000,
  });
  return toResult(completion);
}
