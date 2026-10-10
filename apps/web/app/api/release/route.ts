import { NextResponse } from "next/server";
import { releaseInfo } from "@/lib/release";

export const dynamic = "force-dynamic";

/** The running build: commit, environment and the schema version it expects. Contains no secret. */
export function GET() {
  return NextResponse.json(releaseInfo(), { headers: { "Cache-Control": "no-store" } });
}
