import { fal } from "@fal-ai/client";
import { ProviderError } from "./types";

/**
 * Credential handling and uploads shared by every model that runs on fal —
 * FLUX ControlNet and Nano Banana both authenticate with the same FAL_KEY.
 */

let credentialsConfigured = false;

export function ensureFalCredentials(providerId: string) {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new ProviderError(
      "Chưa có FAL_KEY. Thêm vào file .env.local rồi khởi động lại dev server.",
      providerId,
    );
  }
  if (!credentialsConfigured) {
    fal.config({ credentials: key });
    credentialsConfigured = true;
  }
}

/**
 * Upload to fal's CDN rather than inlining base64: a 4K facade screenshot is
 * ~8 MB, and the returned URL can be reused across several input fields instead
 * of sending the bytes more than once.
 */
export async function uploadToFal(
  buffer: Buffer,
  mime: string,
  providerId: string,
): Promise<string> {
  ensureFalCredentials(providerId);
  try {
    const ext = mime.split("/")[1] ?? "png";
    const file = new File([new Uint8Array(buffer)], `source.${ext}`, {
      type: mime,
    });
    return await fal.storage.upload(file);
  } catch (error) {
    throw new ProviderError(
      `Không upload được ảnh lên fal.ai: ${
        error instanceof Error ? error.message : String(error)
      }`,
      providerId,
      error,
    );
  }
}

/** fal validation errors nest the useful part; surface it instead of "[object Object]". */
export function falErrorMessage(error: unknown, model: string): string {
  const body = (error as { body?: unknown })?.body;
  const detail = (body as { detail?: unknown })?.detail;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((d: { loc?: unknown[]; msg?: string }) =>
        [d.loc?.join("."), d.msg].filter(Boolean).join(": "),
      )
      .filter(Boolean);
    if (parts.length) {
      return `fal.ai từ chối request (${model}): ${parts.join("; ")}`;
    }
  }
  if (typeof detail === "string") {
    return `fal.ai từ chối request (${model}): ${detail}`;
  }

  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) {
    return "FAL_KEY không hợp lệ hoặc hết hạn. Kiểm tra lại key ở fal.ai/dashboard/keys.";
  }
  if (status === 402) {
    return "Tài khoản fal.ai hết credit. Nạp thêm ở fal.ai/dashboard/billing.";
  }
  if (status === 404) {
    return `Không tìm thấy model "${model}". Slug có thể đã đổi — set lại qua biến môi trường tương ứng.`;
  }

  const message = error instanceof Error ? error.message : String(error);
  return `Lỗi từ fal.ai (${model}): ${message}`;
}

export { fal };
