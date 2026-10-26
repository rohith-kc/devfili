// Optional real search engines for endpoints that have no built-in web search.
// Set SEARCH_PROVIDER (tavily | brave | serper) and SEARCH_API_KEY. These calls
// go to fixed provider hosts, never to a model-supplied URL. Returns result
// links only: DevFili fetches and reads the pages itself afterwards.

export type SearchProviderName = "tavily" | "brave" | "serper";

const TIMEOUT_MS = 10000;

export function configuredSearchProvider(): SearchProviderName | null {
  const name = (process.env.SEARCH_PROVIDER ?? "").toLowerCase();
  if (!process.env.SEARCH_API_KEY) return null;
  return name === "tavily" || name === "brave" || name === "serper" ? name : null;
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`search provider returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);
const urlsFrom = (list: Row[], key: string): string[] =>
  list.map((r) => r[key]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));

/** Up to `limit` result URLs from the configured search API, or [] if none is
 * configured or the call fails. Never throws. */
export async function apiSearchLinks(query: string, limit = 6): Promise<string[]> {
  const provider = configuredSearchProvider();
  const key = process.env.SEARCH_API_KEY ?? "";
  if (!provider) return [];
  try {
    if (provider === "tavily") {
      const data = (await fetchJson("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, max_results: limit, search_depth: "basic" }),
      })) as Row;
      return urlsFrom(rows(data.results), "url").slice(0, limit);
    }
    if (provider === "brave") {
      const data = (await fetchJson(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`, {
        headers: { Accept: "application/json", "X-Subscription-Token": key },
      })) as Row;
      return urlsFrom(rows((data.web as Row | undefined)?.results), "url").slice(0, limit);
    }
    const data = (await fetchJson("https://google.serper.dev/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": key },
      body: JSON.stringify({ q: query, num: limit }),
    })) as Row;
    return urlsFrom(rows(data.organic), "link").slice(0, limit);
  } catch {
    return [];
  }
}
