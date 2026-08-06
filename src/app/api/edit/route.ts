import { NextResponse } from "next/server";
import { z } from "zod";
import { startRegionEdit } from "@/lib/edit-jobs";
import { ProviderError } from "@/lib/providers";
import { loadSettings } from "@/lib/settings";

export const runtime = "nodejs";

const bodySchema = z.object({
  parentId: z.string().min(1),
  outputIndex: z.number().int().min(0).max(3).default(0),
  maskPath: z.string().min(1),
  instruction: z
    .string()
    .trim()
    .min(1, "Chưa nhập yêu cầu sửa")
    .max(2000),
  providerId: z.string().optional(),
  outputFormat: z.enum(["jpeg", "png"]).default("png"),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
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

  // Providers read credentials synchronously; the cache has to be warm first.
  await loadSettings();

  try {
    const id = await startRegionEdit(parsed.data);
    return NextResponse.json({ id }, { status: 202 });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[edit] failed to start", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
