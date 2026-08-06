import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLiveJob, serialiseRender } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const record = await prisma.render.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: "Không tìm thấy render." }, { status: 404 });
  }

  return NextResponse.json(serialiseRender(record, getLiveJob(id)), {
    headers: { "Cache-Control": "no-store" },
  });
}
