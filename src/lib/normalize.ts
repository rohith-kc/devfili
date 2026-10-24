/** Parses `value` as a URL, treating a bare domain (no protocol) as one too.
 * Returns null for anything that isn't plausibly a URL (no dot in the host,
 * or contains spaces). */
function tryParseUrl(value: string): URL | null {
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

/** Normalizes a chat/CLI query for app resolution: trim, lower-case; if it
 * looks like a URL, take the hostname without a leading www. */
export function normalizeQuery(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return trimmed;
  const url = tryParseUrl(trimmed);
  if (url) return url.hostname.replace(/^www\./, "");
  return trimmed;
}

/** lowercase letters, digits and hyphens - the slug shape required by
 * content/apps.json and the Resolve prompt. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
