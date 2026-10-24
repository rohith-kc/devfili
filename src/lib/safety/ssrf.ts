import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAME_SUFFIXES = [".internal", ".local"];
const USER_AGENT = "DevFiliBot/1.0";
const ALLOWED_PORTS = new Set([80, 443]);

export function isHostnameBlockedByName(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost") return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

function isIpv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private 10/8
  if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16/12
  if (a === 192 && b === 168) return true; // private 192.168/16
  if (a === 169 && b === 254) return true; // link-local, includes cloud metadata 169.254.169.254
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}

function isIpv6Blocked(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true; // loopback / unspecified
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local fc00::/7
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isIpv4Blocked(v4Mapped[1]);
  return false;
}

export function isIpBlocked(ip: string): boolean {
  if (net.isIP(ip) === 4) return isIpv4Blocked(ip);
  if (net.isIP(ip) === 6) return isIpv6Blocked(ip);
  return true; // not a recognizable IP - block defensively
}

export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
}

/** Validates a single URL (no redirect following): scheme, credentials,
 * port, hostname blocklist, and - after a DNS lookup - every resolved IP. */
export async function checkUrlSafety(urlString: string): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `protocol ${url.protocol} not allowed` };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials in URL are not allowed" };
  }
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    return { ok: false, reason: `port ${port} not allowed` };
  }
  if (isHostnameBlockedByName(url.hostname)) {
    return { ok: false, reason: "blocked hostname" };
  }

  if (net.isIP(url.hostname)) {
    return isIpBlocked(url.hostname) ? { ok: false, reason: "blocked IP address" } : { ok: true };
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    return { ok: false, reason: "DNS resolution failed" };
  }
  if (addresses.length === 0) return { ok: false, reason: "DNS resolution returned no addresses" };
  if (addresses.some((addr) => isIpBlocked(addr.address))) {
    return { ok: false, reason: "blocked IP address" };
  }
  return { ok: true };
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number | null;
  text: string | null;
  finalUrl: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

/** Fetches `urlString` under the SSRF guard: re-checks safety on every hop
 * (including after a redirect), applies a timeout and a byte cap, and
 * identifies as DevFiliBot/1.0. Never follows a redirect to an unsafe URL. */
export async function safeFetch(urlString: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = urlString;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safety = await checkUrlSafety(currentUrl);
    if (!safety.ok) {
      return { ok: false, status: null, text: null, finalUrl: currentUrl, error: safety.reason };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });
    } catch {
      clearTimeout(timer);
      return { ok: false, status: null, text: null, finalUrl: currentUrl, error: "fetch failed or timed out" };
    }
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { ok: false, status: response.status, text: null, finalUrl: currentUrl, error: "redirect with no location" };
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    const text = await readCapped(response, maxBytes);
    return { ok: true, status: response.status, text, finalUrl: currentUrl };
  }

  return { ok: false, status: null, text: null, finalUrl: currentUrl, error: "too many redirects" };
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, maxBytes);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8").slice(0, maxBytes);
}
