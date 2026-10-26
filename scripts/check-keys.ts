import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { loadEnvLocal } from "./env";

const env = loadEnvLocal();
const secrets = [
  env.GEMINI_API_KEY,
  env.GROQ_API_KEY,
  env.OPENROUTER_API_KEY,
  env.LLM_API_KEY,
  env.SUPABASE_SERVICE_ROLE_KEY,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
].filter((v): v is string => !!v && v.length > 8);

function redact(text: string): string {
  let out = text;
  for (const secret of secrets) {
    out = out.split(secret).join("[redacted]");
  }
  return out;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return redact(err.message);
  return redact(String(err));
}

let anyFail = false;

function record(name: string, pass: boolean, detail: string) {
  if (!pass) anyFail = true;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} - ${detail}`);
}

async function checkGroq() {
  const key = env.GROQ_API_KEY;
  if (!key) {
    record("Groq", !!customKey(), customKey() ? "GROQ_API_KEY is blank - not needed, the custom LLM_* endpoint is used for every stage." : "GROQ_API_KEY is blank in .env.local. Next step: open .env.local, paste your Groq key after GROQ_API_KEY=, save.");
    return;
  }
  const baseURL = env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
  const client = new OpenAI({ apiKey: key, baseURL });

  let models: string[] = [];
  try {
    const list = await client.models.list();
    models = list.data.map((m) => m.id).sort();
    record("Groq: list models", true, `${models.length} models available`);
  } catch (err) {
    record("Groq: list models", false, `could not list models - ${describeError(err)}. Next step: check the key was copied in full and is active on console.groq.com.`);
    return;
  }

  const fastModel = env.GROQ_MODEL_FAST || "llama-3.3-70b-versatile";
  try {
    const completion = await client.chat.completions.create({
      model: fastModel,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      max_tokens: 5,
    });
    const text = completion.choices[0]?.message?.content ?? "";
    record(`Groq: tiny completion (${fastModel})`, true, `model replied "${text.trim().slice(0, 30)}"`);
  } catch (err) {
    record(`Groq: tiny completion (${fastModel})`, false, `${describeError(err)}. Next step: confirm GROQ_MODEL_FAST is a real model id from the list below.`);
  }

  const draftModel = env.GROQ_MODEL_DRAFT || "openai/gpt-oss-120b";
  try {
    const completion = await client.chat.completions.create({
      model: draftModel,
      messages: [{ role: "user", content: "Describe a cat as JSON." }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "animal",
          strict: true,
          schema: {
            type: "object",
            properties: { name: { type: "string" }, legs: { type: "number" } },
            required: ["name", "legs"],
            additionalProperties: false,
          },
        },
      },
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    JSON.parse(text);
    record(`Groq: strict JSON schema (${draftModel})`, true, "structured output parsed");
  } catch (err) {
    record(
      `Groq: strict JSON schema (${draftModel})`,
      false,
      `${describeError(err)}. Next step: strict structured output only works on openai/gpt-oss-20b or openai/gpt-oss-120b; set GROQ_MODEL_DRAFT to one of those.`
    );
  }

  // groq/compound and groq/compound-mini were decommissioned 2026-09-21. Groq's
  // current built-in web search is the browser_search tool on a gpt-oss model.
  try {
    const completion = await client.chat.completions.create({
      model: draftModel,
      messages: [{ role: "user", content: "Search the web for today's top technology news headline and tell me what it is." }],
      tool_choice: "required",
      tools: [{ type: "browser_search" } as unknown as OpenAI.Chat.Completions.ChatCompletionTool],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    record(`Groq: browser_search tool (${draftModel})`, true, `model replied "${text.trim().slice(0, 40)}"`);
  } catch (err) {
    record(
      `Groq: browser_search tool (${draftModel})`,
      false,
      `${describeError(err)}. Next step: this is Groq's web-search fallback for research; without it, PROVIDER_RESEARCH=groq cannot browse the web.`
    );
  }

  if (models.length) {
    console.log("\nGroq model ids available (choose GROQ_MODEL_DRAFT / GROQ_MODEL_FAST from this list):");
    console.log(models.map((m) => `  - ${m}`).join("\n"));
  }
}

function customKey(): string {
  return env.LLM_API_KEY || env.OPENROUTER_API_KEY || "";
}

async function checkCustomEndpoint() {
  const key = customKey();
  if (!key) {
    record("Custom model endpoint", true, "LLM_API_KEY is blank - the optional custom OpenAI-compatible endpoint is not used. This is fine; Gemini and Groq still work without it.");
    return;
  }
  const baseURL = env.LLM_BASE_URL || env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const model = env.LLM_MODEL || env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct";
  const isOpenRouter = /openrouter\.ai/i.test(baseURL);
  const client = new OpenAI({ apiKey: key, baseURL, defaultHeaders: { "HTTP-Referer": "https://devfili.app", "X-Title": "DevFili" } });
  const label = `Custom endpoint ${new URL(baseURL).hostname}`;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      max_tokens: 5,
    });
    const text = completion.choices[0]?.message?.content ?? "";
    record(`${label}: tiny completion (${model})`, true, `model replied "${text.trim().slice(0, 30)}"`);
  } catch (err) {
    record(
      `${label}: tiny completion (${model})`,
      false,
      `${describeError(err)}. Next step: check LLM_BASE_URL, LLM_MODEL (a model id your account can use) and that the key has access.`
    );
    return;
  }

  try {
    const { customComplete } = await import("../src/lib/llm/custom");
    const result = await customComplete({
      apiKey: key,
      baseURL,
      model,
      prompt: 'Reply with JSON only: {"ok": true, "items": ["a", "b"]}',
      jsonMode: true,
      maxTokens: 8000,
    });
    const parsed = JSON.parse(result.text.replace(/```(?:json)?/g, "").trim());
    record(`${label}: JSON answer with a large output budget`, parsed?.ok === true, parsed?.ok === true ? "structured JSON works (DevFili adapts max_tokens / JSON mode if the endpoint needs it)" : `unexpected reply: ${result.text.slice(0, 80)}`);
  } catch (err) {
    record(
      `${label}: JSON answer with a large output budget`,
      false,
      `${describeError(err)}. Next step: DevFili asks for JSON answers of several thousand tokens; check that this model allows that output size.`
    );
  }

  if (!isOpenRouter) {
    record(`${label}: web search`, true, "no built-in web search on this endpoint - DevFili will fetch the provider's public docs itself and let the model read them (set LLM_WEB_SEARCH=off to make this explicit).");
    return;
  }
  try {
    const completion = await client.chat.completions.create({
      model: `${model}:online`,
      messages: [{ role: "user", content: "Search the web for today's top technology news headline and tell me what it is." }],
      max_tokens: 200,
    });
    const text = completion.choices[0]?.message?.content ?? "";
    record(`${label}: web search (${model}:online)`, true, `model replied "${text.trim().slice(0, 40)}"`);
  } catch (err) {
    record(`${label}: web search (${model}:online)`, false, `${describeError(err)}. Next step: set LLM_WEB_SEARCH=off to use DevFili's own page fetching instead.`);
  }
}

function printAqKeyAdvice() {
  console.log(
    "\nThis Gemini key starts with 'AQ.' - AI Studio's newer key format. Some of these keys return 401 ACCESS_TOKEN_TYPE_UNSUPPORTED on the SDK/REST endpoint used here."
  );
  console.log("Next step: in .env.local set PROVIDER_RESEARCH=groq and PROVIDER_CHECK=groq, or generate an older-style Gemini key in AI Studio.");
}

async function checkGemini() {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    record("Gemini", !!customKey(), customKey() ? "GEMINI_API_KEY is blank - not needed, the custom LLM_* endpoint is used for every stage." : "GEMINI_API_KEY is blank in .env.local. Next step: open .env.local, paste your Gemini key after GEMINI_API_KEY=, save.");
    return;
  }
  const ai = new GoogleGenAI({ apiKey: key });

  const modelIds: string[] = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m.name) modelIds.push(m.name.replace(/^models\//, ""));
    }
    record("Gemini: list models", true, `${modelIds.length} models available`);
  } catch (err) {
    const detail = describeError(err);
    record("Gemini: list models", false, detail);
    if (/ACCESS_TOKEN_TYPE_UNSUPPORTED/.test(detail) || key.startsWith("AQ.")) {
      printAqKeyAdvice();
    }
    return;
  }

  const researchModel = env.GEMINI_MODEL_RESEARCH || modelIds.find((m) => /flash/.test(m)) || modelIds[0];
  if (!researchModel) {
    record("Gemini: tiny generation", false, "no model id to test with");
    return;
  }

  try {
    await ai.models.generateContent({ model: researchModel, contents: "Reply with the single word: pong" });
    record(`Gemini: tiny generation (${researchModel})`, true, "model replied");
  } catch (err) {
    record(`Gemini: tiny generation (${researchModel})`, false, describeError(err));
  }

  try {
    await ai.models.generateContent({
      model: researchModel,
      contents: "Say ok.",
      config: { tools: [{ googleSearch: {} }] },
    });
    record("Gemini: googleSearch tool call", true, "call accepted");
  } catch (err) {
    record("Gemini: googleSearch tool call", false, describeError(err));
  }

  const checkModel = env.GEMINI_MODEL_CHECK || researchModel;
  try {
    await ai.models.generateContent({
      model: checkModel,
      contents: "Summarize https://nodejs.org in one sentence.",
      config: { tools: [{ urlContext: {} }] },
    });
    record(`Gemini: urlContext tool call (${checkModel})`, true, "call accepted");
  } catch (err) {
    record(`Gemini: urlContext tool call (${checkModel})`, false, describeError(err));
  }

  if (modelIds.length) {
    console.log("\nGemini model ids available (choose GEMINI_MODEL_RESEARCH / GEMINI_MODEL_CHECK from this list):");
    console.log(modelIds.map((m) => `  - ${m}`).join("\n"));
  }
}

async function checkSupabase() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.log("SKIP  Supabase - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set yet (fill these in after creating the project)");
    return;
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    record("Supabase: reachable", res.ok, res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} - check the project URL and anon key`);
  } catch (err) {
    record("Supabase: reachable", false, describeError(err));
  }
}

async function main() {
  console.log("Checking provider keys in .env.local (never prints key values)...\n");
  await checkGroq();
  console.log("");
  await checkGemini();
  console.log("");
  await checkCustomEndpoint();
  console.log("");
  await checkSupabase();
  console.log("");
  if (anyFail) {
    console.log("Some checks failed. Fix the items marked FAIL above, then run: npm run check-keys");
    process.exit(1);
  } else {
    console.log("All configured checks passed.");
  }
}

main();
