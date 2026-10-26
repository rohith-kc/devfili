import type { Env } from "./router";
import { callWithRetry } from "./router";
import { groqComplete } from "./groq";
import { openrouterComplete } from "./openrouter";

export interface PlainCompleteOptions {
  jsonMode?: boolean;
  maxTokens?: number;
}

/** Providers that can answer a plain prompt, in the order to try them.
 * Groq first and OpenRouter second by default; OpenRouter first when it is
 * the configured primary (one key, any model). Providers without a key are skipped. */
export function plainProviders(env: Env): ("groq" | "openrouter")[] {
  const order: ("groq" | "openrouter")[] = env.openrouterFirst ? ["openrouter", "groq"] : ["groq", "openrouter"];
  return order.filter((p) => (p === "groq" ? !!env.groqApiKey : !!env.openrouterApiKey));
}

/** A plain completion through the first provider that works. Throws the last
 * error when every provider fails, or a clear message when none is configured. */
export async function plainComplete(
  env: Env,
  stage: string,
  prompt: string,
  opts: PlainCompleteOptions = {}
): Promise<{ text: string; totalTokens: number | null }> {
  const providers = plainProviders(env);
  if (providers.length === 0) throw new Error(`${stage}: no provider key is configured`);

  let lastError: unknown;
  for (const provider of providers) {
    try {
      if (provider === "groq") {
        return await callWithRetry(stage, "groq", env.groqModelFast, () =>
          groqComplete({ apiKey: env.groqApiKey, baseURL: env.groqBaseUrl, model: env.groqModelFast, prompt, ...opts })
        );
      }
      return await callWithRetry(stage, "openrouter", env.openrouterModel, () =>
        openrouterComplete({ apiKey: env.openrouterApiKey, baseURL: env.openrouterBaseUrl, model: env.openrouterModel, prompt, ...opts })
      );
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
