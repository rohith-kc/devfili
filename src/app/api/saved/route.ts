import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { Guide } from "@/lib/schema";

export const runtime = "nodejs";

const MAX_SAVED_PER_DEVICE = 50;
const DeviceId = z.uuid();

const PostBody = z.object({ deviceId: DeviceId, guide: Guide });

function unavailable() {
  return Response.json({ error: "unavailable", message: "Saving to the database isn't available right now." }, { status: 503 });
}

export async function GET(req: NextRequest) {
  const device = DeviceId.safeParse(req.nextUrl.searchParams.get("device"));
  if (!device.success) return Response.json({ error: "invalid_device" }, { status: 400 });
  const client = getAdminClient();
  if (!client) return unavailable();

  const { data, error } = await client
    .from("saved_guides")
    .select("app_slug, app_name, guide, saved_at")
    .eq("device_id", device.data)
    .order("saved_at", { ascending: false })
    .limit(MAX_SAVED_PER_DEVICE);
  if (error) return unavailable();

  const saved = (data ?? []).flatMap((row) => {
    const parsed = Guide.safeParse(row.guide);
    return parsed.success
      ? [{ slug: row.app_slug as string, name: row.app_name as string, savedAt: row.saved_at as string, guide: parsed.data }]
      : [];
  });
  return Response.json({ saved });
}

export async function POST(req: NextRequest) {
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const client = getAdminClient();
  if (!client) return unavailable();

  const { deviceId, guide } = parsed.data;
  const { error } = await client.from("saved_guides").upsert({
    device_id: deviceId,
    app_slug: guide.app.slug,
    app_name: guide.app.name,
    guide,
    saved_at: new Date().toISOString(),
  });
  if (error) return unavailable();

  const { data: rows } = await client
    .from("saved_guides")
    .select("app_slug")
    .eq("device_id", deviceId)
    .order("saved_at", { ascending: false });
  const extra = (rows ?? []).slice(MAX_SAVED_PER_DEVICE).map((r) => r.app_slug as string);
  if (extra.length > 0) await client.from("saved_guides").delete().eq("device_id", deviceId).in("app_slug", extra);

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const device = DeviceId.safeParse(req.nextUrl.searchParams.get("device"));
  const slug = z.string().min(1).max(100).safeParse(req.nextUrl.searchParams.get("slug"));
  if (!device.success || !slug.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const client = getAdminClient();
  if (!client) return unavailable();

  const { error } = await client.from("saved_guides").delete().eq("device_id", device.data).eq("app_slug", slug.data);
  if (error) return unavailable();
  return Response.json({ ok: true });
}
