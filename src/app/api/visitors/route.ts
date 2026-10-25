import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const Body = z.object({ deviceId: z.uuid(), name: z.string().trim().min(1).max(40) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const client = getAdminClient();
  if (!client) return Response.json({ error: "unavailable" }, { status: 503 });

  const { error } = await client
    .from("visitors")
    .upsert(
      { device_id: parsed.data.deviceId, name: parsed.data.name, last_seen: new Date().toISOString() },
      { onConflict: "device_id" }
    );
  if (error) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json({ ok: true });
}
