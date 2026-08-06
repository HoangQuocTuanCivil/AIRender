import { NextResponse } from "next/server";
import { contentTypeForPath, readStoredFile } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Serves images out of the storage dir. `resolveStoragePath` (inside
 * `readStoredFile`) rejects anything that escapes the root, so a crafted
 * `../../.env` returns 400 rather than a file.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  const relativePath = segments.map(decodeURIComponent).join("/");

  try {
    const buffer = await readStoredFile(relativePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeForPath(relativePath),
        "Content-Length": String(buffer.byteLength),
        // Stored files are immutable — the filename contains a uuid.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Không tìm thấy ảnh." }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith("Đường dẫn")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[files] failed", error);
    return NextResponse.json({ error: "Lỗi đọc ảnh." }, { status: 500 });
  }
}
