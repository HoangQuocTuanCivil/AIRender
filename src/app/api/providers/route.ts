import { NextResponse } from "next/server";
import { describeProviders } from "@/lib/providers";
import { loadSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the UI warn about a missing API key before the user hits Render. */
export async function GET() {
  // `configured` is computed from the keys, which may have been saved in Cài
  // đặt rather than the environment.
  await loadSettings();

  return NextResponse.json(
    { providers: describeProviders() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
