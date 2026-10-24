import type { Claim, CheckResult, DClaim, Finding, Probe, Source } from "./schema";

const OLD_SOURCE_YEARS = 2;

function todayYear(today: string): number {
  return Number.parseInt(today.slice(0, 4), 10);
}

function isOldSource(type: Source["type"], publishedYear: number | null, today: string): boolean {
  if (type === "official" || publishedYear === null) return false;
  return todayYear(today) - publishedYear >= OLD_SOURCE_YEARS;
}

/** Looks up the most informative probe recorded for a given URL. */
function probeForUrl(url: string, probes: Probe[]): Probe | undefined {
  return probes.find((p) => p.url === url);
}

export function recheckFor(finding: Finding, probes: Probe[]): Source["recheck"] {
  const probe = probeForUrl(finding.sourceUrl, probes);
  if (!probe || !probe.readable) return "not_rechecked";
  return probe.excerptFound ? "confirmed" : "mismatch";
}

export interface LabelResult {
  label: Claim["label"];
  sources: Source[];
  testNote: string | null;
  uncertainReason: string | null;
}

/**
 * Turns a model-drafted claim (citing only finding/probe ids) into a labeled
 * Claim. `neverTested` must be set by the caller for wait/effort ranges and
 * any other timeline claim - those can never be labeled Tested.
 */
export function labelClaim(
  dclaim: DClaim,
  findings: Finding[],
  probes: Probe[],
  today: string,
  opts: { neverTested?: boolean } = {}
): LabelResult {
  const findingById = new Map(findings.map((f) => [f.id, f]));
  const probeById = new Map(probes.map((p) => [p.id, p]));

  const matchedFindings = dclaim.findingIds.map((id) => findingById.get(id)).filter((f): f is Finding => !!f);
  const matchedProbeIds = dclaim.probeIds.filter((id) => probeById.has(id));
  const matchedProbes = matchedProbeIds.map((id) => probeById.get(id)!);

  const sources: Source[] = matchedFindings.map((finding) => ({
    url: finding.sourceUrl,
    title: finding.sourceTitle,
    type: finding.sourceType,
    accessedOn: today,
    publishedYear: finding.publishedYear,
    oldSource: isOldSource(finding.sourceType, finding.publishedYear, today),
    recheck: recheckFor(finding, probes),
  }));

  const tested = !opts.neverTested && matchedProbes.some((p) => p.readable && p.mustContainAll);
  if (tested) {
    const passing = matchedProbes.find((p) => p.readable && p.mustContainAll)!;
    return {
      label: "tested",
      sources,
      testNote: `Fetched ${passing.url} on ${today}; the required terms were present.`,
      uncertainReason: null,
    };
  }

  if (matchedFindings.length === 0) {
    return { label: "uncertain", sources, testNote: null, uncertainReason: "no supporting source" };
  }

  const allMismatchOr404 = sources.every((s) => {
    if (s.recheck === "mismatch") return true;
    const probe = probeForUrl(s.url, probes);
    return probe?.status === 404;
  });
  if (allMismatchOr404) {
    const reason = sources.some((s) => s.recheck === "mismatch")
      ? "quoted fragment not found at source"
      : "source could not be opened";
    return { label: "uncertain", sources, testNote: null, uncertainReason: reason };
  }

  return { label: "sourced", sources, testNote: null, uncertainReason: null };
}

/**
 * Applies the independent fact-check stage on top of an already-labeled
 * claim. Runs after claim ids are assigned, since check results are matched
 * by claim id.
 */
export function applyCheckResult(labeled: LabelResult, check: CheckResult | undefined): LabelResult {
  if (!check) return labeled;
  if (check.verdict === "unsupported" || check.verdict === "conflict") {
    return { ...labeled, label: "uncertain", uncertainReason: check.reason };
  }
  if (check.verdict === "partial") {
    return labeled; // label unchanged; caller sets claim.checked = 'partial'
  }
  return labeled; // 'supported'
}
