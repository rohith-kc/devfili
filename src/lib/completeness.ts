import type { Claim, Gate, Step, Tier } from "./schema";

export interface CompletenessInput {
  tier: Tier | null;
  scopes: { claim: Claim }[];
  prerequisites: { claim: Claim }[];
  steps: Step[];
  gates: { provider: Gate; customerAdmin: Gate; endUser: Gate };
  stuckPoints: { claim: Claim }[];
}

export interface CompletenessResult {
  status: "complete" | "incomplete";
  thinSections: string[];
}

function hasNonUncertain(claims: Claim[]): boolean {
  return claims.some((c) => c.label !== "uncertain");
}

const MIN_STEPS = 3;
const MIN_STUCK_POINTS = 2;

/** Complete only if the tier is known, scopes/prerequisites/stuck points
 * exist with real evidence, every step has an owner, and all three gates
 * carry at least one non-Uncertain claim. Otherwise Incomplete, listing which
 * sections are thin. */
export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const thinSections: string[] = [];

  if (input.tier === null) thinSections.push("Verdict");

  if (input.scopes.length < 1 || !hasNonUncertain(input.scopes.map((s) => s.claim))) {
    thinSections.push("Scopes");
  }

  if (input.prerequisites.length < 1 || !hasNonUncertain(input.prerequisites.map((p) => p.claim))) {
    thinSections.push("Prepare before you start");
  }

  const stepsHaveOwners = input.steps.every((s) => !!s.owner);
  const stepClaims = input.steps.flatMap((s) => s.claims);
  if (input.steps.length < MIN_STEPS || !stepsHaveOwners || !hasNonUncertain(stepClaims)) {
    thinSections.push("Steps");
  }

  const gateClaims = [...input.gates.provider.claims, ...input.gates.customerAdmin.claims, ...input.gates.endUser.claims];
  if (!hasNonUncertain(gateClaims)) {
    thinSections.push("The three gates");
  }

  if (input.stuckPoints.length < MIN_STUCK_POINTS || !hasNonUncertain(input.stuckPoints.map((p) => p.claim))) {
    thinSections.push("Where it gets stuck");
  }

  return { status: thinSections.length === 0 ? "complete" : "incomplete", thinSections };
}
