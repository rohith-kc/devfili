import { GoogleGenAI } from "@google/genai";

export type GeminiTool = "googleSearch" | "urlContext";

export interface GeminiCallOptions {
  apiKey: string;
  model: string;
  prompt: string;
  tools?: GeminiTool[];
}

export interface GeminiCallResult {
  text: string;
  totalTokens: number | null;
}

function toolConfig(tool: GeminiTool) {
  return tool === "googleSearch" ? { googleSearch: {} } : { urlContext: {} };
}

/** One Gemini generateContent call, optionally with googleSearch and/or
 * urlContext grounding tools. Throws on provider error - the caller (router)
 * is responsible for retry/fallback. */
export async function geminiGenerate(opts: GeminiCallOptions): Promise<GeminiCallResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const response = await ai.models.generateContent({
    model: opts.model,
    contents: opts.prompt,
    ...(opts.tools && opts.tools.length > 0 ? { config: { tools: opts.tools.map(toolConfig) } } : {}),
  });
  return { text: response.text ?? "", totalTokens: response.usageMetadata?.totalTokenCount ?? null };
}

export interface GeminiJsonModeOptions {
  apiKey: string;
  model: string;
  prompt: string;
}

/** Gemini's own structured-output mode (response_mime_type: application/json),
 * used as the draft stage's fallback when Groq's strict mode is unavailable. */
export async function geminiGenerateJson(opts: GeminiJsonModeOptions): Promise<GeminiCallResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const response = await ai.models.generateContent({
    model: opts.model,
    contents: opts.prompt,
    config: { responseMimeType: "application/json" },
  });
  return { text: response.text ?? "", totalTokens: response.usageMetadata?.totalTokenCount ?? null };
}
