import type { Claim, GateState, Tier } from "./schema";

export interface LabeledFact {
  value: boolean | null;
  claim: Claim | null;
}

export interface TierFacts {
  partnerGated: LabeledFact;
  securityAssessment: LabeledFact;
  reviewRequired: LabeledFact;
}

export type TierReasonKey = "partner_gated" | "security_assessment" | "review_required" | "self_serve" | "unknown";

export interface TierResult {
  tier: Tier | null;
  reasonKey: TierReasonKey;
}

/** First match wins; unknown facts give Unknown, never Tier 1 by default. */
export function computeTier(facts: TierFacts): TierResult {
  if (facts.partnerGated.value === true) return { tier: 4, reasonKey: "partner_gated" };
  if (facts.securityAssessment.value === true) return { tier: 3, reasonKey: "security_assessment" };
  if (facts.reviewRequired.value === true) return { tier: 2, reasonKey: "review_required" };
  if (facts.partnerGated.value === false && facts.securityAssessment.value === false && facts.reviewRequired.value === false) {
    return { tier: 1, reasonKey: "self_serve" };
  }
  return { tier: null, reasonKey: "unknown" };
}

/** Customer admin is a flag, not a tier: it comes straight from the fact. */
export function customerAdminGateState(customerAdminLikely: boolean | null): GateState {
  if (customerAdminLikely === true) return "yes";
  if (customerAdminLikely === false) return "no";
  return "unknown";
}

export function gatedAccess(tier: Tier | null): boolean {
  return tier === 4;
}
