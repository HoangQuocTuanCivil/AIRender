import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A seed round-trips only if it survived JSON parsing intact. fal returns seeds
 * far past Number.MAX_SAFE_INTEGER, where the value JavaScript holds is already
 * approximate — re-sending one would quietly render something different from
 * the image it is labelled with.
 *
 * Lives here rather than in jobs.ts because client components need it, and
 * importing a value (not just a type) from jobs.ts drags Prisma and
 * better-sqlite3 into the browser bundle.
 */
export function isReusableSeed(seed: string | null | undefined): boolean {
  if (!seed) return false;
  const parsed = Number(seed);
  return Number.isSafeInteger(parsed) && parsed >= 0;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}p ${Math.round(seconds % 60)}s`;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;

  if (diff < 60_000) return "vừa xong";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} ngày trước`;

  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Read pixel dimensions in the browser so the server never needs an image
 * decoding dependency just to pick an output aspect ratio.
 */
export function readImageSize(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được kích thước ảnh."));
    };
    img.src = url;
  });
}

/** Trigger a browser download for a same-origin image URL. */
export async function downloadImage(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Không tải được ảnh.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Downloaded files land in the user's Downloads folder among everything else,
 * so the name has to identify the render without opening it: product, the date
 * it was made, then enough of the id to find the row again in the library.
 */
export function renderFilename(
  render: {
    id: string;
    createdAt: string;
    outputFormat: string;
    outputUrls: string[];
  },
  index: number,
): string {
  const date = new Date(render.createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? ""
    : [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("") + "-";
  // Only number the files when there is more than one to tell apart.
  const suffix = render.outputUrls.length > 1 ? `-${index + 1}` : "";
  return `A2ZRender-${stamp}${render.id.slice(0, 8)}${suffix}.${render.outputFormat}`;
}

/**
 * Saves every image of a render. Sequential with a gap between files: Chrome
 * throttles a burst of programmatic downloads from one gesture and silently
 * drops the tail, so firing them all at once loses images.
 */
export async function downloadRender(render: {
  id: string;
  createdAt: string;
  outputFormat: string;
  outputUrls: string[];
}): Promise<void> {
  for (const [index, url] of render.outputUrls.entries()) {
    await downloadImage(url, renderFilename(render, index));
    if (index < render.outputUrls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
}
