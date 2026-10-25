import type { Range, Tier } from "./schema";

export const TIER_LABEL: Record<Tier, string> = {
  1: "Tier 1 · Self-serve",
  2: "Tier 2 · Reviewed",
  3: "Tier 3 · Security reviewed",
  4: "Tier 4 · Partner-gated",
};

export function tierLabel(tier: Tier | null): string {
  return tier === null ? "Tier unknown" : TIER_LABEL[tier];
}

const UNIT_LABEL: Record<Range["unit"], { one: string; many: string }> = {
  hours: { one: "hour", many: "hours" },
  days: { one: "day", many: "days" },
  business_days: { one: "business day", many: "business days" },
  weeks: { one: "week", many: "weeks" },
};

export function rangeLabel(range: Range | null): string {
  if (!range) return "Unknown";
  const unit = UNIT_LABEL[range.unit];
  const label = range.max === 1 ? unit.one : unit.many;
  if (range.min === range.max) return `${range.min} ${label}`;
  return `${range.min}–${range.max} ${label}`;
}

export const BASIS_LABEL: Record<Range["basis"], string> = {
  official: "official",
  reported: "reported",
  estimated: "estimated",
};

export const OWNER_LABEL: Record<string, string> = {
  agent_did: "Agent did",
  agent_drafted: "Agent drafted",
  you_do: "You do",
};

export const GATE_LABEL: Record<string, string> = {
  yes: "Yes",
  no: "No",
  unknown: "Unknown",
};
