import OpenAI from "openai";

export interface CustomClientOptions {
  apiKey: string;
  baseURL: string;
}

export interface CustomCallResult {
  text: string;
  totalTokens: number | null;
}

// Long structured answers (the guide drafts) can take a slow model well over a
// minute, so the default is generous. LLM_TIMEOUT_SECONDS changes it.
function requestTimeoutMs(): number {
  const seconds = Number(process.env.LLM_TIMEOUT_SECONDS);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 150) * 1000;
}

function client(opts: CustomClientOptions): OpenAI {
  return new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    timeout: requestTimeoutMs(),
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

type Params = Record<string, unknown>;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** OpenAI-compatible endpoints disagree on a few request options. Rather than
 * fail, adapt once or twice to what the endpoint says it does not accept:
 * `max_completion_tokens` instead of `max_tokens` (newer OpenAI-style models),
 * and no `response_format` (endpoints without JSON mode; the prompts already
 * ask for JSON only). */
export function adaptParams(params: Params, err: unknown): Params | null {
  const message = errorText(err);
  if ("max_tokens" in params && /max_completion_tokens/i.test(message)) {
    const { max_tokens, ...rest } = params;
    return { ...rest, max_completion_tokens: max_tokens };
  }
  if ("max_completion_tokens" in params && /max_tokens/i.test(message) && !/max_completion_tokens/i.test(message)) {
    const { max_completion_tokens, ...rest } = params;
    return { ...rest, max_tokens: max_completion_tokens };
  }
  if ("response_format" in params && /response_format|json_object|json mode|json_schema|structured output/i.test(message)) {
    const { response_format, ...rest } = params;
    void response_format;
    return rest;
  }
  return null;
}

async function createChat(opts: CustomClientOptions, initial: Params): Promise<CustomCallResult> {
  const openai = client(opts);
  let params = initial;
  for (let attempt = 0; ; attempt++) {
    try {
      const completion = await openai.chat.completions.create(
        params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
      );
      return toResult(completion);
    } catch (err) {
      const adapted = attempt < 2 ? adaptParams(params, err) : null;
      if (!adapted) throw err;
      params = adapted;
    }
  }
}

export interface CustomCompletionOptions extends CustomClientOptions {
  model: string;
  prompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
}

/** A plain (or best-effort JSON-object mode) chat completion on the custom
 * endpoint. Throws on provider error, same contract as groqComplete. */
export async function customComplete(opts: CustomCompletionOptions): Promise<CustomCallResult> {
  return createChat(opts, {
    model: opts.model,
    messages: [{ role: "user", content: opts.prompt }],
    ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  });
}

export interface CustomSearchOptions extends CustomClientOptions {
  model: string;
  /** Append ":online" (OpenRouter only). Other endpoints answer from the pages in the prompt. */
  online?: boolean;
  prompt: string;
  maxTokens?: number;
}

/** Research call on the custom endpoint. With online=true, appends ":online"
 * to the model id on OpenRouter, which turns on its built-in web-search
 * plugin; otherwise the prompt itself carries the pages to read. */
export async function customSearchComplete(opts: CustomSearchOptions): Promise<CustomCallResult> {
  return createChat(opts, {
    model: opts.online === false ? opts.model : `${opts.model}:online`,
    messages: [{ role: "user", content: opts.prompt }],
    max_tokens: opts.maxTokens ?? 6000,
  });
}
