export interface Env {
  geminiApiKey: string;
  geminiModelResearch: string;
  geminiModelCheck: string;
  groqApiKey: string;
  groqBaseUrl: string;
  groqModelDraft: string;
  groqModelFast: string;
  customApiKey: string;
  customBaseUrl: string;
  customModel: string;
  /** Try OpenRouter before Gemini and Groq for every stage (one key, any model). */
  customFirst: boolean;
  /** Whether OpenRouter's ":online" web search can be used (only on openrouter.ai). */
  customSearch: boolean;
  providerResearch: "gemini" | "groq";
  providerCheck: "gemini" | "groq";
}

/** Reads provider configuration from process.env, with the same defaults as
 * .env.example. Server-only - never exposed to the browser. */
export function loadEnv(): Env {
  // LLM_* is the neutral name for "any OpenAI-compatible endpoint" (OpenAI, xAI
  // Grok, AWS Bedrock's OpenAI-compatible API, a company gateway, OpenRouter...).
  // OPENROUTER_* is still read, so existing setups keep working.
  const customApiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "";
  const customBaseUrl = process.env.LLM_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const onlyCustom = !!customApiKey && !process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY;
  const searchSetting = (process.env.LLM_WEB_SEARCH || process.env.OPENROUTER_WEB_SEARCH || "").toLowerCase();
  const primary = (process.env.PRIMARY_PROVIDER ?? "").toLowerCase();
  return {
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModelResearch: process.env.GEMINI_MODEL_RESEARCH ?? "",
    geminiModelCheck: process.env.GEMINI_MODEL_CHECK ?? "",
    groqApiKey: process.env.GROQ_API_KEY ?? "",
    groqBaseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    groqModelDraft: process.env.GROQ_MODEL_DRAFT || "openai/gpt-oss-120b",
    groqModelFast: process.env.GROQ_MODEL_FAST || "openai/gpt-oss-20b",
    customApiKey,
    customBaseUrl,
    customModel: process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct",
    customFirst: !!customApiKey && (primary === "custom" || primary === "openrouter" || onlyCustom),
    customSearch: searchSetting ? searchSetting !== "off" : /openrouter\.ai/i.test(customBaseUrl),
    providerResearch: process.env.PROVIDER_RESEARCH === "groq" ? "groq" : "gemini",
    providerCheck: process.env.PROVIDER_CHECK === "groq" ? "groq" : "gemini",
  };
}

export interface StageLog {
  stage: string;
  provider: string;
  model: string;
  durationMs: number;
  ok: boolean;
  totalTokens?: number | null;
  error?: string;
}

export type Logger = (log: StageLog) => void;

/** Never logs keys or full prompts - only stage/provider/model/duration and,
 * when the provider returned one, a token count. */
export const defaultLogger: Logger = (log) => {
  const parts = [
    `stage=${log.stage}`,
    `provider=${log.provider}`,
    `model=${log.model}`,
    `ms=${log.durationMs}`,
    `ok=${log.ok}`,
  ];
  if (log.totalTokens != null) parts.push(`tokens=${log.totalTokens}`);
  if (log.error) parts.push(`error=${log.error}`);
  console.log(`[research] ${parts.join(" ")}`);
};

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number } | undefined)?.status;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;
  return /timeout|ETIMEDOUT|ECONNRESET|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(describeError(err));
}

const RETRY_BACKOFF_MIN_MS = 1000;
const RETRY_BACKOFF_JITTER_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CallResultLike {
  totalTokens?: number | null;
}

/** Runs `fn`, retrying once after a 1-2s jittered backoff on a 429/5xx/
 * timeout-shaped error. Logs stage/provider/model/duration either way, then
 * rethrows on a second failure so the caller can decide whether to fall back
 * to another provider. */
export async function callWithRetry<T extends CallResultLike>(
  stage: string,
  provider: string,
  model: string,
  fn: () => Promise<T>,
  logger: Logger = defaultLogger
): Promise<T> {
  const attempt = async (): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      logger({ stage, provider, model, durationMs: Date.now() - start, ok: true, totalTokens: result.totalTokens });
      return result;
    } catch (err) {
      logger({ stage, provider, model, durationMs: Date.now() - start, ok: false, error: describeError(err) });
      throw err;
    }
  };

  try {
    return await attempt();
  } catch (err) {
    if (!isRetryableError(err)) throw err;
    await sleep(RETRY_BACKOFF_MIN_MS + Math.random() * RETRY_BACKOFF_JITTER_MS);
    return attempt();
  }
}
