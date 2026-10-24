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

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

async function bumpAndCheck(bucket: string, limit: number): Promise<RateLimitResult> {
  const client = getAdminClient();
  if (!client) {
    return memoryFailSafeAllow(bucket) ? { allowed: true } : { allowed: false, reason: "rate limited (database unreachable, fail-safe)" };
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

export interface LiveRunActor {
  ip?: string;
  userId?: string;
}

/** Non-cached live runs only. Checks the global ceiling first, then the
 * actor-specific one (signed-in user by id, guest by hashed IP). Never
 * blocks library pages - this is only called for live research. */
export async function checkLiveRunLimit(actor: LiveRunActor): Promise<RateLimitResult> {
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
  const limit = Number(process.env.HELPER_RUNS_PER_DAY) || 30;
  const bucket = actor.userId ? `helper:${actor.userId}` : actor.ip ? `helper:${hashIp(actor.ip)}` : "helper:anon";
  return bumpAndCheck(bucket, limit);
}
