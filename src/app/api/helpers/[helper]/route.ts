import type { NextRequest } from "next/server";
import { z } from "zod";
import { Guide, HelperKind, type Claim } from "@/lib/schema";
import { loadEnv } from "@/lib/llm/router";
import { groqComplete } from "@/lib/llm/groq";
import { looksLikeSecret } from "@/lib/safety/secrets";
import { checkHelperRunLimit, type LiveRunActor } from "@/lib/safety/ratelimit";

export const runtime = "nodejs";

const MAX_INPUT_CHARS = 4000;

const RequestBody = z.object({
  guide: Guide,
  inputs: z.record(z.string(), z.string().max(MAX_INPUT_CHARS)),
});

function clientIp(req: NextRequest): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

function factLine(claim: Claim): string {
  return `- [${claim.label}] ${claim.text}`;
}

function buildPrompt(helper: HelperKind, guide: z.infer<typeof Guide>, inputs: Record<string, string>): { prompt: string; factsUsed: string[] } | null {
  if (helper === "scope_justification") {
    const facts = [guide.verdict.tierReason, ...guide.scopes.map((s) => s.claim)];
    const product = inputs.product?.trim() || "the developer's app";
    const scopes = guide.scopes.map((s) => s.scope).join(", ") || "(no scopes listed)";
    const prompt = [
      `Write a reviewer-facing justification for each scope the developer chose.`,
      `Developer's product: ${product}. Scopes: ${scopes}.`,
      `Facts about this provider's review:\n${facts.map(factLine).join("\n")}`,
      `For each scope: one sentence on what the product does with it, one on why a narrower scope would not work, one on what the product does NOT do with the data. Plain, honest, specific; no exaggeration. Flag any scope that looks broader than the product needs.`,
      `Output Markdown. End with the exact line "Draft: review before use."`,
    ].join("\n\n");
    return { prompt, factsUsed: facts.map((f) => f.text) };
  }

  if (helper === "test_plan") {
    const facts = [guide.verdict.tierReason, ...guide.prerequisites.map((p) => p.claim), ...guide.howItWorks.flow];
    const signup = inputs.signup?.trim() || "(not provided - use a reasonable placeholder)";
    const flow = inputs.flow?.trim() || "(not provided - use a reasonable placeholder)";
    const prompt = [
      `Write a test plan a provider's reviewer can follow.`,
      `How a reviewer signs up: ${signup}. The main flow: ${flow}.`,
      `Provider requirements:\n${facts.map(factLine).join("\n")}`,
      `Use placeholders such as <TEST_ACCOUNT_EMAIL> and <TEST_ACCOUNT_PASSWORD>; NEVER invent or ask for real credentials. Include: prerequisites, numbered steps with expected results, how to install and uninstall (deauthorization), what data is accessed, and who to contact.`,
      `Output Markdown. End with the exact line "Draft: review before use."`,
    ].join("\n\n");
    return { prompt, factsUsed: facts.map((f) => f.text) };
  }

  if (helper === "admin_note") {
    if (guide.gates.customerAdmin.applies === "no") return null;
    const facts = guide.gates.customerAdmin.claims.length > 0 ? guide.gates.customerAdmin.claims : [guide.verdict.tierReason];
    const appName = inputs.appName?.trim() || "our app";
    const company = inputs.company?.trim() || "your company";
    const prompt = [
      `Write a short, polite message the developer can send to a customer's IT admin asking them to approve ${appName} for ${company} so it can connect to ${guide.app.name}.`,
      `Use only these facts about what the admin must do:\n${facts.map(factLine).join("\n")}\nWhat: ${guide.gates.customerAdmin.what}`,
      `Steps numbered, exact menu paths only if the facts give them, what permissions will be granted, why they are needed, how to revoke, and a contact line. Offer a version for email and a 3-line version for chat.`,
      `Output Markdown. End with the exact line "Draft: review before use."`,
    ].join("\n\n");
    return { prompt, factsUsed: facts.map((f) => f.text) };
  }

  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ helper: string }> }) {
  const { helper: helperParam } = await params;
  const helperResult = HelperKind.safeParse(helperParam);
  if (!helperResult.success || helperResult.data === "checklist" || helperResult.data === "pre_submission") {
    return Response.json({ error: "unknown_helper", message: "This helper doesn't call the model." }, { status: 400 });
  }
  const helper = helperResult.data;

  const json = await req.json().catch(() => null);
  const parsed = RequestBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid_input", message: "Missing or invalid guide/inputs." }, { status: 400 });
  }
  const { guide, inputs } = parsed.data;

  for (const value of Object.values(inputs)) {
    if (looksLikeSecret(value)) {
      return Response.json({ error: "secret_detected", message: "That looks like a secret; remove it." }, { status: 400 });
    }
  }

  const actor: LiveRunActor = { ip: clientIp(req) };
  const limit = await checkHelperRunLimit(actor);
  if (!limit.allowed) {
    return Response.json({ error: "rate_limited", message: "You've hit today's helper limit. Try again tomorrow." }, { status: 429 });
  }

  const built = buildPrompt(helper, guide, inputs);
  if (!built) {
    return Response.json({ error: "not_applicable", message: "This helper doesn't apply to this guide." }, { status: 400 });
  }

  const env = loadEnv();
  if (!env.groqApiKey) {
    return Response.json({ error: "provider_busy", message: "The draft service isn't configured right now." }, { status: 503 });
  }

  try {
    const result = await groqComplete({
      apiKey: env.groqApiKey,
      baseURL: env.groqBaseUrl,
      model: env.groqModelFast,
      prompt: built.prompt,
      maxTokens: 2000,
    });
    // The prompt asks the model to end with this exact line so earlier
    // reviewers could confirm it followed the "always marked as a draft"
    // rule; the UI now shows that marking itself, so strip the duplicate.
    // Also drop any orphan markdown marker left by truncation mid-list.
    const draft = result.text
      .replace(/\n*\**draft:\s*review before use\.?\**\s*$/i, "")
      .replace(/\n+[*-]\s*$/, "")
      .trimEnd();
    return Response.json({ draft, factsUsed: built.factsUsed });
  } catch {
    return Response.json({ error: "provider_busy", message: "The draft service is busy right now. Try again shortly." }, { status: 503 });
  }
}
