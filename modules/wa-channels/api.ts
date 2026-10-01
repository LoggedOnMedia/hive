import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { waConfig, waEnabled } from "./config";
import { runTick } from "./server/sender";

// Route handlers for /api/wa/*. Currently just the scheduler tick, which the
// Supabase pg_cron job (see setup.mjs) calls every minute.

function authorised(request: NextRequest) {
  const expected = waConfig.cronSecret();
  const given = request.headers.get("x-wa-cron-secret") ?? "";
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!waEnabled()) return new NextResponse("Not found", { status: 404 });
  const path = (await ctx.params).path.join("/");
  if (path !== "tick") return new NextResponse("Not found", { status: 404 });
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Due scheduled posts are picked up here; sends are spaced out inside the run.
  const result = await runTick(45_000);
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
