import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cancelJob, getLiveJob, serialiseRender } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Stop a running job.
 *
 * `cancelJob` aborts the in-flight request; for fal-hosted engines that also
 * cancels it upstream so the work stops being billed. The DB row is written by
 * the job's own catch block, which is the single place that decides a job's
 * terminal state — writing "cancelled" here as well would race it.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const record = await prisma.render.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: "Không tìm thấy render." }, { status: 404 });
  }

  if (record.status !== "pending" && record.status !== "running") {
    return NextResponse.json(
      { error: `Render này đã ở trạng thái "${record.status}", không huỷ được.` },
      { status: 409 },
    );
  }

  const stopped = cancelJob(id);
  if (!stopped) {
    // No controller: the job belonged to a previous server process, so nothing
    // is actually running. Mark it here or it stays "running" for ever.
    const updated = await prisma.render.update({
      where: { id },
      data: {
        status: "cancelled",
        error: "Đã huỷ. Tiến trình render không còn chạy (server đã khởi động lại).",
      },
    });
    return NextResponse.json(serialiseRender(updated, getLiveJob(id)));
  }

  return NextResponse.json({ ok: true });
}
