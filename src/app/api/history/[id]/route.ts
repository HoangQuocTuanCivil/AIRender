import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLiveJob, serialiseRender } from "@/lib/jobs";
import { deleteStoredFile } from "@/lib/storage";

export const runtime = "nodejs";

const patchSchema = z.object({ favorite: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body phải có dạng { favorite: boolean }." },
      { status: 400 },
    );
  }

  try {
    const record = await prisma.render.update({
      where: { id },
      data: { favorite: parsed.data.favorite },
    });
    return NextResponse.json(serialiseRender(record, getLiveJob(id)));
  } catch {
    return NextResponse.json({ error: "Không tìm thấy render." }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const record = await prisma.render.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: "Không tìm thấy render." }, { status: 404 });
  }

  let outputs: string[] = [];
  try {
    outputs = JSON.parse(record.outputPaths) as string[];
  } catch {
    outputs = [];
  }

  // Remove the generated images but keep the upload: several renders can share
  // one source image, and deleting it would break their history entries.
  await Promise.all(outputs.map(deleteStoredFile));
  await prisma.render.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
