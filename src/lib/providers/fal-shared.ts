import { fal } from "@fal-ai/client";
import { secret } from "../settings";
import { ProviderError, RenderCancelledError } from "./types";

/**
 * Credential handling and uploads shared by every model that runs on fal —
 * FLUX ControlNet and Nano Banana both authenticate with the same FAL_KEY.
 */

/** The client is configured globally, so remember which key is loaded in it. */
let configuredKey: string | null = null;

export function ensureFalCredentials(providerId: string) {
  const key = secret("FAL_KEY");
  if (!key) {
    throw new ProviderError(
      "Chưa có FAL_KEY. Thêm ở mục Cài đặt, hoặc đặt biến môi trường FAL_KEY trong .env.local.",
      providerId,
    );
  }
  // Compared, not just flagged: a key replaced in Cài đặt has to reach the
  // client without a restart.
  if (configuredKey !== key) {
    fal.config({ credentials: key });
    configuredKey = key;
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

/**
 * `fal.subscribe` with real cancellation.
 *
 * The client exposes a `timeout` option but documents it as not enforced, so
 * the deadline is imposed here instead. More importantly, aborting locally only
 * stops us waiting — the request keeps running and keeps being billed. Capturing
 * the request id from `onEnqueue` lets us call `fal.queue.cancel`, which stops
 * the work on fal's side too.
 */
/**
 * Shape of the queue callback. Declared here because the options object is
 * widened to pass through the extra `onEnqueue`, which loses fal's inference.
 */
export type FalQueueUpdate = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | string;
  queue_position?: number;
  logs?: { message?: string }[];
};

export async function subscribeCancellable<T>(
  model: string,
  options: Record<string, unknown>,
  signal: AbortSignal | undefined,
): Promise<{ data: T }> {
  let requestId: string | null = null;

  const wrapped = {
    ...options,
    onEnqueue(id: string) {
      requestId = id;
      (options as { onEnqueue?: (id: string) => void }).onEnqueue?.(id);
    },
  };

  const run = fal.subscribe(
    model,
    wrapped as Parameters<typeof fal.subscribe>[1],
  ) as Promise<{ data: T }>;

  if (!signal) return run;

  const aborted = new Promise<never>((_, reject) => {
    const onAbort = () => {
      // Best effort: fal refuses to cancel a request that already started, in
      // which case we at least stop waiting for it.
      if (requestId) {
        void fal.queue.cancel(model, { requestId }).catch(() => {});
      }
      reject(new RenderCancelledError());
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });

  return Promise.race([run, aborted]);
}

export { fal };
