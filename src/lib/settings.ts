import { railColorById } from "./brand";
import { prisma } from "./db";
import { publicUrlFor } from "./storage";

/**
 * Settings the user edits in the Cài đặt screen: provider API keys and the app
 * icon. They live in SQLite instead of .env.local so the tool configures itself
 * from its own UI — a key pasted in the browser takes effect on the next render
 * without a server restart.
 *
 * Server-only — this imports Prisma. Client components may `import type` from
 * here but never a value; see the client/server boundary note in AGENTS.md.
 */

export const BRAND_ICON_KEY = "brand.iconPath";
export const BRAND_RAIL_COLOR_KEY = "brand.railColor";

/** Where the credential actually in use came from. */
export type SecretSource = "settings" | "env" | "none";

let cache = new Map<string, string>();

/**
 * Refresh the in-memory copy from the database.
 *
 * Providers read credentials synchronously (`isConfigured()`), so every route
 * that resolves a provider must await this first. It re-queries every time
 * rather than caching with an expiry: one indexed read of a handful of rows
 * from a local file is cheaper than reasoning about when the cache went stale.
 */
export async function loadSettings(): Promise<void> {
  try {
    const rows = await prisma.setting.findMany();
    cache = new Map(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    // A fresh clone has no Setting table until `npm run db:push`. Falling back
    // to the environment beats taking every route down.
    console.error("[settings] không đọc được bảng Setting", error);
  }
}

export function storedValue(key: string): string | undefined {
  return cache.get(key) || undefined;
}

/**
 * Credential lookup used by the providers. A value saved in Cài đặt outranks
 * the environment variable of the same name: it is the more recent and more
 * visible action, and the Cài đặt screen names the source of every key so the
 * precedence is never a guess.
 */
export function secret(name: string): string | undefined {
  return storedValue(name) || process.env[name] || undefined;
}

export function secretSource(name: string): SecretSource {
  if (storedValue(name)) return "settings";
  if (process.env[name]) return "env";
  return "none";
}

/** Enough of a key to tell two apart, not enough to use one. */
export function maskSecret(value: string): string {
  return value.length <= 4 ? "••••" : `••••••••${value.slice(-4)}`;
}

export async function putSetting(
  key: string,
  value: string | null,
): Promise<void> {
  if (value === null) {
    await prisma.setting.deleteMany({ where: { key } });
    cache.delete(key);
    return;
  }
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  cache.set(key, value);
}

/** Storage-relative path of the uploaded icon, or null for the default badge. */
export async function getBrandIconPath(): Promise<string | null> {
  await loadSettings();
  return storedValue(BRAND_ICON_KEY) ?? null;
}

export async function getBrandIconUrl(): Promise<string | null> {
  const path = await getBrandIconPath();
  return path ? publicUrlFor(path) : null;
}

/**
 * Id of the chosen rail colour, or the default. Returns the id rather than the
 * hex so an unknown value (a palette entry removed later) degrades to the
 * default instead of painting the rail with a dead string.
 */
export async function getRailColorId(): Promise<string> {
  await loadSettings();
  return railColorById(storedValue(BRAND_RAIL_COLOR_KEY)).id;
}
