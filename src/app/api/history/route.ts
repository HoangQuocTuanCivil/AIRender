import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLiveJob, serialiseRender } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const onlyFavorites = url.searchParams.get("favorites") === "1";
  const limit = Math.min(
    Number(url.searchParams.get("limit")) || PAGE_SIZE,
    100,
  );

  const records = await prisma.render.findMany({
    where: onlyFavorites ? { favorite: true } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = records.length > limit;
  const page = hasMore ? records.slice(0, limit) : records;

  return NextResponse.json(
    {
      items: page.map((record) => serialiseRender(record, getLiveJob(record.id))),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
