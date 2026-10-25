import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../llm/router";
import { discover } from "./discover";
import { probeFindings } from "./probe";
import { draftCore, draftPath } from "./draft";
import { runCheck } from "./check";
import { claimsForCheck, finalizeGuide } from "./finalize";
import { loadApps, resolveApp } from "./resolve";
import { getCachedGuide, setCachedGuide } from "./cache";
import { checkLiveRunLimit, type LiveRunActor } from "../safety/ratelimit";
import type { Claim, Guide } from "../schema";

export type ErrorCode = "invalid_input" | "not_found" | "no_oauth" | "rate_limited" | "provider_busy" | "timeout" | "internal";

export type StageEvent =
  | { type: "status"; stage: number; key: string; state: "active" | "done"; message: string }
  | { type: "question"; text: string; candidates: { name: string; websiteUrl: string | null; description: string }[] }
  | { type: "result"; guide: Guide; cached: boolean; researchedAt: string }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "done" };

const STAGE_MESSAGES: Record<number, string> = {
  1: "Working out which app you mean",
  2: "Finding the developer docs and review pages",
  3: "Reading scopes, requirements and review steps",
  4: "Looking for delays and rejections others hit",
  5: "Checking that the pages and steps exist",
  6: "Writing the guide in the standard format",
  7: "Checking every claim against its source",
  8: "Done: open the guide or save it",
};

function status(stage: number, state: "active" | "done"): StageEvent {
  return { type: "status", stage, key: `stage-${stage}`, state, message: STAGE_MESSAGES[stage] };
}

function loadLibraryGuide(slug: string): Guide | null {
  const file = path.join(process.cwd(), "content", "library", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Guide;
  } catch {
    return null;
  }
}

function relabelUncertainIfNotTested(claim: Claim): Claim {
  if (claim.label === "tested") return claim;
  return { ...claim, label: "uncertain", uncertainReason: "not checked in time", checked: "unchecked" };
}

/** Deadline reached before the check stage could run: cap every non-tested
 * claim at Uncertain and mark the guide Incomplete, per SPEC section 8. */
function capUncheckedClaims(guide: Guide): Guide {
  const c = relabelUncertainIfNotTested;
  const next: Guide = {
    ...guide,
    verdict: { ...guide.verdict, tierReason: c(guide.verdict.tierReason), scopeForks: guide.verdict.scopeForks.map(c) },
    managedApp: {
      ...guide.managedApp,
      claim: guide.managedApp.claim ? c(guide.managedApp.claim) : null,
      whatYouLose: guide.managedApp.whatYouLose.map(c),
      whenToSwitch: guide.managedApp.whenToSwitch.map(c),
    },
    howItWorks: {
      flow: guide.howItWorks.flow.map(c),
      appTypes: guide.howItWorks.appTypes.map(c),
      tokenNotes: guide.howItWorks.tokenNotes.map(c),
    },
    scopes: guide.scopes.map((s) => ({ ...s, claim: c(s.claim) })),
    prerequisites: guide.prerequisites.map((p) => ({ ...p, claim: c(p.claim) })),
    steps: guide.steps.map((s) => ({ ...s, claims: s.claims.map(c) })),
    gates: {
      provider: { ...guide.gates.provider, claims: guide.gates.provider.claims.map(c) },
      customerAdmin: { ...guide.gates.customerAdmin, claims: guide.gates.customerAdmin.claims.map(c) },
      endUser: { ...guide.gates.endUser, claims: guide.gates.endUser.claims.map(c) },
    },
    stuckPoints: guide.stuckPoints.map((sp) => ({ ...sp, claim: c(sp.claim) })),
    whileYouWait: guide.whileYouWait.map(c),
    keepsComingBack: guide.keepsComingBack.map(c),
    hardToUndo: guide.hardToUndo.map(c),
    completeness: { status: "incomplete", thinSections: [] },
    derived: { unverifiedClaimIds: [], sources: guide.derived.sources },
  };

  const allClaims: Claim[] = [
    next.verdict.tierReason,
    ...next.verdict.scopeForks,
    ...(next.managedApp.claim ? [next.managedApp.claim] : []),
    ...next.managedApp.whatYouLose,
    ...next.managedApp.whenToSwitch,
    ...next.howItWorks.flow,
    ...next.howItWorks.appTypes,
    ...next.howItWorks.tokenNotes,
    ...next.scopes.map((s) => s.claim),
    ...next.prerequisites.map((p) => p.claim),
    ...next.steps.flatMap((s) => s.claims),
    ...next.gates.provider.claims,
    ...next.gates.customerAdmin.claims,
    ...next.gates.endUser.claims,
    ...next.stuckPoints.map((sp) => sp.claim),
    ...next.whileYouWait,
    ...next.keepsComingBack,
    ...next.hardToUndo,
  ];
  next.derived.unverifiedClaimIds = allClaims.filter((cl) => cl.label === "uncertain").map((cl) => cl.id);
  next.completeness = { status: "incomplete", thinSections: [...guide.completeness.thinSections, "Ran out of time to check every claim"] };
  return next;
}

export interface RunOptions {
  choice?: { name: string; websiteUrl: string | null };
  deadlineSeconds?: number;
  today?: string;
  actor?: LiveRunActor;
  /** Library generation: always research live, ignoring any existing
   * content/library/<slug>.json or research_cache entry. */
  forceLive?: boolean;
}

const DEFAULT_DEADLINE_SECONDS = 240;
const CHECK_STAGE_MIN_BUDGET_MS = 5000;

/** Runs the full research pipeline (resolve -> discover -> probe -> draft ->
 * finalize -> check -> finalize), yielding the same status/question/result/
 * error/done events the SSE route streams to the browser. A CLI caller can
 * just print each event; the API route re-emits them as SSE. */
export async function* runPipeline(query: string, options: RunOptions = {}): AsyncGenerator<StageEvent> {
  const env = loadEnv();
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const deadlineAt = Date.now() + (options.deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS) * 1000;

  const trimmed = query.trim();
  if (trimmed.length < 2 || trimmed.length > 200) {
    yield { type: "error", code: "invalid_input", message: "Type an app name or URL between 2 and 200 characters." };
    yield { type: "done" };
    return;
  }

  yield status(1, "active");
  let resolved;
  try {
    resolved = options.choice
      ? ({
          type: "app" as const,
          app: {
            name: options.choice.name,
            slug: options.choice.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            websiteUrl: options.choice.websiteUrl,
          },
        } as const)
      : await resolveApp(trimmed, env, today);
  } catch {
    yield { type: "error", code: "provider_busy", message: "The research assistant is busy or rate-limited right now. Try again in a while, or browse the reviewed library below." };
    yield { type: "done" };
    return;
  }
  yield status(1, "done");

  if (resolved.type === "ambiguous") {
    yield { type: "question", text: resolved.note, candidates: resolved.candidates };
    return;
  }
  if (resolved.type === "not_found") {
    yield { type: "error", code: "not_found", message: resolved.note };
    yield { type: "done" };
    return;
  }

  let app: { name: string; slug: string; websiteUrl: string | null };
  if (resolved.type === "library") {
    const guide = options.forceLive ? null : loadLibraryGuide(resolved.slug);
    if (guide) {
      yield { type: "result", guide, cached: false, researchedAt: guide.lastVerifiedOn };
      yield { type: "done" };
      return;
    }
    // Matched a library slug but either its reviewed file doesn't exist yet
    // (pre-Phase-3) or the caller asked to force live research (library
    // generation) - fall through to live research using apps.json.
    const entry = loadApps().find((a) => a.slug === resolved.slug);
    app = { name: entry?.name ?? resolved.slug, slug: resolved.slug, websiteUrl: entry?.websiteUrl ?? null };
  } else {
    app = resolved.app;
  }

  const cached = options.forceLive ? null : await getCachedGuide(app.slug);
  if (cached) {
    yield { type: "result", guide: cached.guide, cached: true, researchedAt: cached.researchedAt };
    yield { type: "done" };
    return;
  }

  if (options.actor) {
    const limit = await checkLiveRunLimit(options.actor);
    if (!limit.allowed) {
      yield { type: "error", code: "rate_limited", message: "You've hit today's research limit. Try again tomorrow, or browse the library." };
      yield { type: "done" };
      return;
    }
  }

  yield status(2, "active");
  yield status(3, "active");
  yield status(4, "active");
  let discoverResult;
  try {
    discoverResult = await discover(env, app.name, app.websiteUrl ?? "", today);
  } catch {
    yield { type: "error", code: "provider_busy", message: "Research providers are busy or rate-limited right now. Try again in a while, or browse the reviewed library below." };
    yield { type: "done" };
    return;
  }
  yield status(2, "done");
  yield status(3, "done");
  yield status(4, "done");

  if (discoverResult.findings.length === 0) {
    yield { type: "error", code: "not_found", message: `Could not find developer or OAuth documentation for ${app.name}.` };
    yield { type: "done" };
    return;
  }

  yield status(5, "active");
  const probes = await probeFindings(discoverResult.findings);
  yield status(5, "done");

  yield status(6, "active");
  let core, draftedPath;
  try {
    core = await draftCore(env, today, app.name, app, discoverResult.findings, probes);
    draftedPath = await draftPath(env, today, app.name, app, discoverResult.findings, probes, core);
  } catch {
    yield { type: "error", code: "provider_busy", message: "Could not draft the guide right now - the provider may be rate-limited. Try again in a while, or browse the reviewed library below." };
    yield { type: "done" };
    return;
  }
  yield status(6, "done");

  let guide = finalizeGuide({ app, kind: "live", today, core, path: draftedPath, findings: discoverResult.findings, probes });

  yield status(7, "active");
  if (deadlineAt - Date.now() > CHECK_STAGE_MIN_BUDGET_MS) {
    const checkClaims = claimsForCheck(guide, discoverResult.findings);
    try {
      const { results } = await runCheck(env, today, checkClaims);
      guide = finalizeGuide({
        app,
        kind: "live",
        today,
        core,
        path: draftedPath,
        findings: discoverResult.findings,
        probes,
        checkResults: results,
      });
    } catch {
      // keep the pre-check guide; its non-tested claims simply stay unchecked
    }
  } else {
    guide = capUncheckedClaims(guide);
  }
  yield status(7, "done");
  yield status(8, "done");

  if (!options.forceLive) await setCachedGuide(app.slug, guide);
  yield { type: "result", guide, cached: false, researchedAt: today };
  yield { type: "done" };
}
