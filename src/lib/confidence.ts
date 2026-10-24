import type { Claim, Confidence, Range, Source, Tier } from "./schema";

export interface ConfidenceInput {
  tier: Tier | null;
  tierFactClaims: (Claim | null)[];
  wait: Range | null;
  sources: Source[];
}

/** high if tier is non-null, all tier-fact claims are not Uncertain, and the
 * wait basis is official; low if tier is null, wait basis is estimated, any
 * tier-fact claim is Uncertain, or the only sources are community sources
 * older than 2 years; otherwise medium. */
export function computeConfidence(input: ConfidenceInput): Confidence {
  const existingTierClaims = input.tierFactClaims.filter((c): c is Claim => c !== null);
  const anyTierClaimUncertain = existingTierClaims.some((c) => c.label === "uncertain");
  const onlyOldCommunitySources =
    input.sources.length > 0 && input.sources.every((s) => s.type === "community" && s.oldSource);
  const waitEstimated = input.wait !== null && input.wait.basis === "estimated";

  if (input.tier === null || waitEstimated || anyTierClaimUncertain || onlyOldCommunitySources) {
    return "low";
  }

  const waitOfficial = input.wait !== null && input.wait.basis === "official";
  if (!anyTierClaimUncertain && waitOfficial) {
    return "high";
  }

  return "medium";
}
