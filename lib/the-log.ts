import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// Shared-secret auth for The Log's calls into Hive. The Log keeps the key on
// its server and sends it as `Authorization: Bearer <key>`.

export function checkTheLogAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.THE_LOG_API_KEY;
  if (!expected) return NextResponse.json({ error: "The Log connection isn't set up on Hive." }, { status: 503 });

  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** The sender name stores see on messages from The Log. */
export const THE_LOG_SENDER = "Logged On Media";
