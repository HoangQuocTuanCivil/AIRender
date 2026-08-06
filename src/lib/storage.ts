import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Images live outside `public/` so that writing a render never invalidates the
 * Next dev server's static asset graph, and so nothing is silently exposed.
 * They are served back through the guarded `/api/files/[...path]` route.
 */
let cachedRoot: string | null = null;

/**
 * Resolved lazily: a top-level `path.resolve(process.cwd(), …)` makes Next's
 * static analysis trace the entire project into the server bundle.
 */
export function storageRoot(): string {
  if (cachedRoot) return cachedRoot;
  cachedRoot = path.resolve(
    /* turbopackIgnore: true */
    process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"),
  );
  return cachedRoot;
}

export const UPLOADS_DIR = "uploads";
export const RENDERS_DIR = "renders";
/** App icon set in Cài đặt; served through the same guarded file route. */
export const BRANDING_DIR = "branding";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const ACCEPTED_MIME_TYPES = Object.keys(MIME_TO_EXT);
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? "png";
}

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Resolve a storage-relative path to an absolute one, refusing anything that
 * escapes the storage root (`../`, absolute paths, symlink-ish tricks).
 */
export function resolveStoragePath(relativePath: string): string {
  const normalised = path
    .normalize(relativePath)
    .replace(/^([/\\])+/, "");
  const storage = storageRoot();
  const absolute = path.resolve(storage, normalised);

  const root = storage.endsWith(path.sep) ? storage : storage + path.sep;

  if (!absolute.startsWith(root)) {
    throw new Error(`Đường dẫn không hợp lệ: ${relativePath}`);
  }
  return absolute;
}

/** Save raw bytes under `dir`, returning the storage-relative path. */
export async function saveBuffer(
  dir: string,
  buffer: Buffer,
  mime: string,
  baseName: string = randomUUID(),
): Promise<string> {
  const ext = extensionForMime(mime);
  const relativePath = `${dir}/${baseName}.${ext}`;
  const absolute = resolveStoragePath(relativePath);
  await ensureDir(path.dirname(absolute));
  await writeFile(/* turbopackIgnore: true */ absolute, buffer);
  return relativePath;
}

/** Download a provider result so it can be re-encoded before being stored. */
export async function fetchImage(
  url: string,
  fallbackMime: string,
): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Không tải được ảnh kết quả (${response.status} ${response.statusText})`,
    );
  }
  void fallbackMime;
  return Buffer.from(await response.arrayBuffer());
}

/** Download a provider result URL into local storage. */
export async function saveRemoteImage(
  dir: string,
  url: string,
  fallbackMime: string,
  baseName?: string,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Không tải được ảnh kết quả (${response.status} ${response.statusText})`,
    );
  }
  const mime = response.headers.get("content-type") ?? fallbackMime;
  const buffer = Buffer.from(await response.arrayBuffer());
  return saveBuffer(dir, buffer, mime.split(";")[0].trim(), baseName);
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  return readFile(/* turbopackIgnore: true */ resolveStoragePath(relativePath));
}

export async function deleteStoredFile(relativePath: string): Promise<void> {
  try {
    await unlink(/* turbopackIgnore: true */ resolveStoragePath(relativePath));
  } catch {
    // Already gone — deleting a history entry should not fail on this.
  }
}

export function contentTypeForPath(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase().replace(".", "");
  const found = Object.entries(MIME_TO_EXT).find(([, e]) => e === ext);
  return found?.[0] ?? "application/octet-stream";
}

/** Public URL the browser uses to fetch a stored image. */
export function publicUrlFor(relativePath: string): string {
  return `/api/files/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

/** Stable short id for logging/filenames derived from content. */
export function contentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

/**
 * Providers need a URL they can reach. For local files that means inlining the
 * bytes as a data URI — the storage dir is not internet-reachable.
 */
export async function toDataUri(relativePath: string): Promise<string> {
  const buffer = await readStoredFile(relativePath);
  const mime = contentTypeForPath(relativePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
