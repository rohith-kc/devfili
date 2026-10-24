import { getAdminClient } from "../supabase/admin";
import { Guide, type Guide as GuideType } from "../schema";

const DEFAULT_CACHE_DAYS = 7;

export interface CachedResult {
  guide: GuideType;
  researchedAt: string;
}

/** Best-effort cache read. Never throws - a database problem is a cache
 * miss, not a research failure. Returns null for anything older than
 * RESEARCH_CACHE_DAYS. */
export async function getCachedGuide(appSlug: string): Promise<CachedResult | null> {
  const client = getAdminClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("research_cache")
      .select("guide, created_at")
      .eq("app_key", appSlug)
      .maybeSingle();
    if (error || !data) return null;

    const cacheDays = Number(process.env.RESEARCH_CACHE_DAYS) || DEFAULT_CACHE_DAYS;
    const ageDays = (Date.now() - new Date(data.created_at as string).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > cacheDays) return null;

    const parsed = Guide.safeParse(data.guide);
    if (!parsed.success) return null;
    return { guide: parsed.data, researchedAt: data.created_at as string };
  } catch {
    return null;
  }
}

/** Best-effort cache write. Never throws - losing a cache write just means
 * the next request researches again. */
export async function setCachedGuide(appSlug: string, guide: GuideType): Promise<void> {
  const client = getAdminClient();
  if (!client) return;
  try {
    await client.from("research_cache").upsert({ app_key: appSlug, guide, created_at: new Date().toISOString() });
  } catch {
    // best effort
  }
}
