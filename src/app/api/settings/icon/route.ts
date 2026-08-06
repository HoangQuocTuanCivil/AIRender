import { NextResponse } from "next/server";
import { MAX_ICON_BYTES } from "@/lib/brand";
import {
  BRAND_ICON_KEY,
  getBrandIconPath,
  putSetting,
} from "@/lib/settings";
import {
  ACCEPTED_MIME_TYPES,
  BRANDING_DIR,
  contentHash,
  deleteStoredFile,
  publicUrlFor,
  saveBuffer,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * The app icon shown in the rail. Stored like any other image — under
 * `storage/`, served through the guarded file route — with its path recorded in
 * the settings table.
 *
 * The filename is a content hash because `/api/files` serves everything as
 * immutable: a fixed name would leave the old icon in the browser cache forever.
 */
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
        error: `Định dạng không hỗ trợ: ${mime || "không xác định"}. Chấp nhận: PNG, JPG, WebP, AVIF.`,
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_ICON_BYTES) {
    return NextResponse.json(
      {
        error: `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB). Icon tối đa ${MAX_ICON_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  try {
    const previous = await getBrandIconPath();
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = await saveBuffer(
      BRANDING_DIR,
      buffer,
      mime,
      `icon-${contentHash(buffer)}`,
    );

    await putSetting(BRAND_ICON_KEY, path);
    if (previous && previous !== path) {
      await deleteStoredFile(previous);
    }

    return NextResponse.json({ iconUrl: publicUrlFor(path) });
  } catch (error) {
    console.error("[settings/icon] failed", error);
    return NextResponse.json(
      { error: "Không lưu được icon lên đĩa." },
      { status: 500 },
    );
  }
}

/** Back to the built-in badge. */
export async function DELETE() {
  const previous = await getBrandIconPath();
  await putSetting(BRAND_ICON_KEY, null);
  if (previous) await deleteStoredFile(previous);

  return NextResponse.json({ iconUrl: null });
}
