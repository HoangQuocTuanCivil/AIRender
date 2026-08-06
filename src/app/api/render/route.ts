import { NextResponse } from "next/server";
import { z } from "zod";
import { startRender } from "@/lib/jobs";
import { ProviderError } from "@/lib/providers";

export const runtime = "nodejs";

const bodySchema = z.object({
  sourcePath: z.string().min(1),
  width: z.number().int().min(64).max(8192),
  height: z.number().int().min(64).max(8192),
  prompt: z.string().min(1, "Prompt không được để trống").max(4000),
  negativePrompt: z.string().max(4000).optional(),
  presetId: z.string().optional(),
  controlMode: z.enum(["canny", "depth", "none"]),
  controlStrength: z.number().min(0).max(1),
  strength: z.number().min(0).max(1),
  guidanceScale: z.number().min(1).max(20),
  steps: z.number().int().min(4).max(50),
  numImages: z.number().int().min(1).max(4),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
  outputFormat: z.enum(["jpeg", "png"]).default("jpeg"),
  providerId: z.string().optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${first.path.join(".") || "body"}: ${first.message}` },
      { status: 400 },
    );
  }

  try {
    const id = await startRender(parsed.data);
    return NextResponse.json({ id }, { status: 202 });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[render] failed to start", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
