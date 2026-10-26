import crypto from "node:crypto";
import { getAdminClient } from "../supabase/admin";

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "";
  return crypto.createHash("sha256").update(ip + salt).digest("hex");
}

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Fail-safe fallback used only when the database is unreachable: at most 2
// runs per bucket per instance per hour, kept in memory.
const MEMORY_FAILSAFE_LIMIT = 2;
const HOUR_MS = 60 * 60 * 1000;
const memoryCounts = new Map<string, { count: number; windowStart: number }>();

function memoryFailSafeAllow(bucket: string): boolean {
  const now = Date.now();
  const entry = memoryCounts.get(bucket);
  if (!entry || now - entry.windowStart > HOUR_MS) {
    memoryCounts.set(bucket, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MEMORY_FAILSAFE_LIMIT) return false;
  entry.count += 1;
  return true;
}

// Used when no database is configured at all (for example a reviewer running
// the app locally without Supabase): honour the real daily limit in memory,
// per server process, instead of the much tighter database-down fail-safe.
const memoryDaily = new Map<string, { day: string; count: number }>();

function memoryDailyAllow(bucket: string, limit: number): boolean {
  const day = utcDateString();
  const entry = memoryDaily.get(bucket);
  if (!entry || entry.day !== day) {
    memoryDaily.set(bucket, { day, count: 1 });
    return limit >= 1;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function resetMemoryLimitsForTests(): void {
  memoryDaily.clear();
  memoryCounts.clear();
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

async function bumpAndCheck(bucket: string, limit: number): Promise<RateLimitResult> {
  const client = getAdminClient();
  if (!client) {
    return memoryDailyAllow(bucket, limit) ? { allowed: true } : { allowed: false, reason: `rate limited (${bucket})` };
  }
  try {
    const { data, error } = await client.rpc("bump_live_run", { p_bucket: bucket, p_day: utcDateString() });
    if (error) throw error;
    const count = data as number;
    return count > limit ? { allowed: false, reason: `rate limited (${bucket})` } : { allowed: true };
  } catch {
    return memoryFailSafeAllow(bucket) ? { allowed: true } : { allowed: false, reason: "rate limited (database unreachable, fail-safe)" };
  }
}

/** DevFili's own daily caps protect a shared deployment's free-tier keys. They are
 * switched off with RATE_LIMITS=off, and off by default while running locally
 * (npm run dev) where the person is using their own keys. RATE_LIMITS=on forces
 * them back on. This never affects a provider's own rate limits (Gemini, Groq...). */
export function ownLimitsDisabled(): boolean {
  const setting = (process.env.RATE_LIMITS ?? "").toLowerCase();
  if (setting === "off") return true;
  if (setting === "on") return false;
  return process.env.NODE_ENV === "development";
}

export interface LiveRunActor {
  ip?: string;
  userId?: string;
}

/** Non-cached live runs only. Checks the global ceiling first, then the
 * actor-specific one (signed-in user by id, guest by hashed IP). Never
 * blocks library pages - this is only called for live research. */
export async function checkLiveRunLimit(actor: LiveRunActor): Promise<RateLimitResult> {
  if (ownLimitsDisabled()) return { allowed: true };
  const globalLimit = Number(process.env.LIVE_RUNS_GLOBAL_PER_DAY) || 150;
  const globalResult = await bumpAndCheck("global", globalLimit);
  if (!globalResult.allowed) return globalResult;

  if (actor.userId) {
    const userLimit = Number(process.env.LIVE_RUNS_PER_USER_PER_DAY) || 15;
    return bumpAndCheck(`user:${actor.userId}`, userLimit);
  }
  if (actor.ip) {
    const guestLimit = Number(process.env.LIVE_RUNS_PER_GUEST_PER_DAY) || 5;
    return bumpAndCheck(`ip:${hashIp(actor.ip)}`, guestLimit);
  }
  return { allowed: true };
}

export async function checkHelperRunLimit(actor: LiveRunActor): Promise<RateLimitResult> {
  if (ownLimitsDisabled()) return { allowed: true };
  const limit = Number(process.env.HELPER_RUNS_PER_DAY) || 30;
  const bucket = actor.userId ? `helper:${actor.userId}` : actor.ip ? `helper:${hashIp(actor.ip)}` : "helper:anon";
  return bumpAndCheck(bucket, limit);
}
