import type { Claim, Range, RangeBasis, RangeUnit, Step } from "./schema";

/** official if the claim cites an official source and is not Uncertain;
 * reported if only community/vendor sources; estimated if no source at all
 * (such a claim is always labeled Uncertain by evidence.ts). */
export function computeBasis(claim: Claim | null): RangeBasis {
  if (!claim || claim.sources.length === 0) return "estimated";
  const hasOfficial = claim.sources.some((s) => s.type === "official");
  if (hasOfficial && claim.label !== "uncertain") return "official";
  return "reported";
}

export function computeWaitRange(
  wait: { min: number; max: number; unit: RangeUnit; claim: Claim } | null
): Range | null {
  if (!wait) return null;
  return { min: wait.min, max: wait.max, unit: wait.unit, basis: computeBasis(wait.claim), claimId: wait.claim.id };
}

const BASIS_STRENGTH: Record<RangeBasis, number> = { estimated: 0, reported: 1, official: 2 };

/** Combines several already-labeled per-step effort ranges into one overall
 * range: the weakest basis among the contributing steps, since the sum is
 * only as trustworthy as its least-certain addend. */
export function computeEffortRange(steps: Step[]): Range | null {
  const effortSteps = steps.filter((s): s is Step & { effort: Range } => s.owner === "you_do" && s.effort !== null);
  if (effortSteps.length === 0) return null;

  const min = effortSteps.reduce((sum, s) => sum + s.effort.min, 0);
  const max = effortSteps.reduce((sum, s) => sum + s.effort.max, 0);
  const basis = effortSteps.reduce<RangeBasis>(
    (weakest, s) => (BASIS_STRENGTH[s.effort.basis] < BASIS_STRENGTH[weakest] ? s.effort.basis : weakest),
    "official"
  );
  return { min, max, unit: "hours", basis, claimId: null };
}

const UNIT_LABEL: Record<RangeUnit, string> = {
  hours: "hours",
  days: "days",
  business_days: "business days",
  weeks: "weeks",
};

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatMinMax(min: number, max: number): string {
  return min === max ? trimNumber(min) : `${trimNumber(min)}-${trimNumber(max)}`;
}

const HOURS_TO_DAYS_THRESHOLD = 16;
const HOURS_PER_DAY = 8;

/** "2-4 hours", "1-3 weeks", "7-10 business days". Hours over 16 display as
 * days (8-hour day) for readability; the stored unit is unaffected. */
export function formatRange(range: Range): string {
  if (range.unit === "hours" && range.max > HOURS_TO_DAYS_THRESHOLD) {
    const toDays = (h: number) => Math.round((h / HOURS_PER_DAY) * 10) / 10;
    return `${formatMinMax(toDays(range.min), toDays(range.max))} days`;
  }
  return `${formatMinMax(range.min, range.max)} ${UNIT_LABEL[range.unit]}`;
}
