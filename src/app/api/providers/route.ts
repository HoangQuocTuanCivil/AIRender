import { NextResponse } from "next/server";
import { describeProviders } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the UI warn about a missing API key before the user hits Render. */
export async function GET() {
  return NextResponse.json(
    { providers: describeProviders() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
