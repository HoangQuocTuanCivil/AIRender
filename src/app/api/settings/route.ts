import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_RAIL_COLOR_ID, RAIL_COLORS } from "@/lib/brand";
import { describeProviders } from "@/lib/providers";
import {
  BRAND_RAIL_COLOR_KEY,
  getBrandIconUrl,
  getRailColorId,
  loadSettings,
  maskSecret,
  putSetting,
  secretSource,
  storedValue,
  type SecretSource,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CredentialInfo {
  /** Env var name, which doubles as the settings key. */
  env: string;
  /** Where to obtain the key. */
  url: string;
  /** Engines this one credential unlocks. */
  engines: string[];
  source: SecretSource;
  /** Tail of the stored key, or null when it comes from the environment. */
  masked: string | null;
}

export interface SettingsResponse {
  credentials: CredentialInfo[];
  brand: { iconUrl: string | null; railColorId: string };
}

async function buildResponse(): Promise<SettingsResponse> {
  return {
    credentials: describeCredentials(),
    brand: {
      iconUrl: await getBrandIconUrl(),
      railColorId: await getRailColorId(),
    },
  };
}

/**
 * Credentials are derived from the provider registry rather than a second list,
 * so adding an engine surfaces its key here automatically. Two engines can share
 * one key (both fal-hosted models use FAL_KEY) — group them instead of asking
 * for the same value twice.
 */
function describeCredentials(): CredentialInfo[] {
  const credentials: CredentialInfo[] = [];

  for (const provider of describeProviders()) {
    const existing = credentials.find((c) => c.env === provider.apiKeyEnv);
    if (existing) {
      existing.engines.push(provider.label);
      continue;
    }
    const stored = storedValue(provider.apiKeyEnv);
    credentials.push({
      env: provider.apiKeyEnv,
      url: provider.apiKeyUrl,
      engines: [provider.label],
      source: secretSource(provider.apiKeyEnv),
      masked: stored ? maskSecret(stored) : null,
    });
  }

  return credentials;
}

export async function GET() {
  await loadSettings();

  return NextResponse.json(await buildResponse(), {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Two shapes so the one screen writes through one route. The credential shape
 * came first and is left untouched, so this stays backwards compatible.
 */
const bodySchema = z.union([
  z.object({
    env: z.string().min(1),
    /** Empty or null clears the stored key and falls back to the environment. */
    value: z.string().max(500).nullable(),
  }),
  z.object({
    /** Palette id; null restores the default. */
    railColor: z.string().max(40).nullable(),
  }),
]);

export async function PUT(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  await loadSettings();

  if ("railColor" in parsed.data) {
    const id = parsed.data.railColor;
    // Store the palette id, never a raw colour: an arbitrary hex written here
    // would end up painted behind the rail's white icons.
    if (id !== null && !RAIL_COLORS.some((c) => c.id === id)) {
      return NextResponse.json(
        { error: `Không có màu nào tên "${id}".` },
        { status: 400 },
      );
    }
    await putSetting(
      BRAND_RAIL_COLOR_KEY,
      id === null || id === DEFAULT_RAIL_COLOR_ID ? null : id,
    );
    return NextResponse.json(await buildResponse());
  }

  // Only keys an engine actually asks for. Otherwise this route is a
  // write-anything endpoint into the settings table.
  const known = new Set(describeProviders().map((p) => p.apiKeyEnv));
  if (!known.has(parsed.data.env)) {
    return NextResponse.json(
      { error: `Không có API key nào tên "${parsed.data.env}".` },
      { status: 400 },
    );
  }

  await putSetting(parsed.data.env, parsed.data.value?.trim() || null);

  return NextResponse.json(await buildResponse());
}
