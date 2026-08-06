import { NextResponse } from "next/server";
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOADS_DIR,
  publicUrlFor,
  saveBuffer,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request phải là multipart/form-data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu trường 'file'." }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  if (!ACCEPTED_MIME_TYPES.includes(mime)) {
    return NextResponse.json(
      {
        error: `Định dạng không hỗ trợ: ${mime || "không xác định"}. Chấp nhận: JPG, PNG, WebP, AVIF.`,
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB). Tối đa ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = await saveBuffer(UPLOADS_DIR, buffer, mime);

    return NextResponse.json({
      path,
      url: publicUrlFor(path),
      bytes: buffer.byteLength,
      contentType: mime,
    });
  } catch (error) {
    console.error("[upload] failed", error);
    return NextResponse.json(
      { error: "Không lưu được ảnh lên đĩa." },
      { status: 500 },
    );
  }
}
