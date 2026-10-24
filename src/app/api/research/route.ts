import type { NextRequest } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/lib/research/pipeline";
import type { LiveRunActor } from "@/lib/safety/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RequestBody = z.object({
  query: z.string().min(2).max(200),
  choice: z.object({ name: z.string(), websiteUrl: z.string().nullable() }).optional(),
});

const HEARTBEAT_MS = 15000;
const DEFAULT_DEADLINE_SECONDS = 240;

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function clientIp(req: NextRequest): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = RequestBody.safeParse(json);

  if (!parsed.success) {
    const body = sseData({ type: "error", code: "invalid_input", message: "Type an app name or URL between 2 and 200 characters." }) + sseData({ type: "done" });
    return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
  }

  const { query, choice } = parsed.data;
  const actor: LiveRunActor = { ip: clientIp(req) };
  const deadlineSeconds = Number(process.env.RESEARCH_DEADLINE_SECONDS) || DEFAULT_DEADLINE_SECONDS;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // stream already closed by the client
        }
      }, HEARTBEAT_MS);

      try {
        for await (const event of runPipeline(query, { choice, deadlineSeconds, actor })) {
          controller.enqueue(encoder.encode(sseData(event)));
        }
      } catch {
        controller.enqueue(encoder.encode(sseData({ type: "error", code: "internal", message: "Something went wrong. Try again." })));
        controller.enqueue(encoder.encode(sseData({ type: "done" })));
      } finally {
        closed = true;
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
