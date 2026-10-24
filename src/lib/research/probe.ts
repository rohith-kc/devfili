import { parse as parseHtml } from "node-html-parser";
import pLimit from "p-limit";
import { safeFetch } from "../safety/ssrf";
import type { Finding, Probe } from "../schema";

const MIN_READABLE_LENGTH = 500;
const MAX_SOURCE_URLS = 15;
const MAX_CHECKABLES = 10;
const PROBE_CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 8000;
const FETCH_MAX_BYTES = 1.5 * 1024 * 1024;
const FETCH_MAX_REDIRECTS = 3;

export function htmlToText(html: string): string {
  try {
    const root = parseHtml(html, { blockTextElements: { script: false, style: false, noscript: false } });
    return root.textContent || "";
  } catch {
    return "";
  }
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function containsNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeForMatch(needle);
  if (!normalizedNeedle) return false;
  return normalizeForMatch(haystack).includes(normalizedNeedle);
}

interface ProbeTarget {
  id: string;
  url: string;
  excerpt?: string;
  mustContain?: string[];
}

async function probeOne(target: ProbeTarget): Promise<Probe> {
  const fetched = await safeFetch(target.url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: FETCH_MAX_BYTES,
    maxRedirects: FETCH_MAX_REDIRECTS,
  });

  if (!fetched.ok || fetched.text === null) {
    return { id: target.id, url: target.url, status: fetched.status, readable: false, excerptFound: false, mustContainAll: false };
  }

  const text = htmlToText(fetched.text);
  const readable = text.length >= MIN_READABLE_LENGTH;
  const excerptFound = readable && !!target.excerpt && containsNormalized(text, target.excerpt);
  const mustContainAll =
    readable && !!target.mustContain && target.mustContain.length > 0 && target.mustContain.every((term) => containsNormalized(text, term));

  return { id: target.id, url: target.url, status: fetched.status, readable, excerptFound, mustContainAll };
}

/** Probes each distinct sourceUrl (cap 15, checking the finding's own
 * excerpt) and each distinct checkable (cap 10, checking its mustContain
 * terms), all under the SSRF guard with bounded concurrency. */
export async function probeFindings(findings: Finding[]): Promise<Probe[]> {
  const limit = pLimit(PROBE_CONCURRENCY);
  const targets: ProbeTarget[] = [];
  let n = 1;

  const seenUrls = new Set<string>();
  for (const f of findings) {
    if (seenUrls.size >= MAX_SOURCE_URLS) break;
    if (seenUrls.has(f.sourceUrl)) continue;
    seenUrls.add(f.sourceUrl);
    targets.push({ id: `P${n++}`, url: f.sourceUrl, excerpt: f.excerpt });
  }

  const seenCheckable = new Set<string>();
  for (const f of findings) {
    if (!f.checkable) continue;
    if (seenCheckable.size >= MAX_CHECKABLES) break;
    const key = `${f.checkable.url}::${f.checkable.mustContain.join("|")}`;
    if (seenCheckable.has(key)) continue;
    seenCheckable.add(key);
    targets.push({ id: `P${n++}`, url: f.checkable.url, mustContain: f.checkable.mustContain });
  }

  return Promise.all(targets.map((t) => limit(() => probeOne(t))));
}
