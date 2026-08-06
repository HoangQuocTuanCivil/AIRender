import { NextResponse } from "next/server";
import { z } from "zod";
import { describeProviders } from "@/lib/providers";
import {
  getBrandIconUrl,
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
  brand: { iconUrl: string | null };
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

  const body: SettingsResponse = {
    credentials: describeCredentials(),
    brand: { iconUrl: await getBrandIconUrl() },
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

const bodySchema = z.object({
  env: z.string().min(1),
  /** Empty or null clears the stored key and falls back to the environment. */
  value: z.string().max(500).nullable(),
});

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

  // Only keys an engine actually asks for. Otherwise this route is a
  // write-anything endpoint into the settings table.
  const known = new Set(describeProviders().map((p) => p.apiKeyEnv));
  if (!known.has(parsed.data.env)) {
    return NextResponse.json(
      { error: `Không có API key nào tên "${parsed.data.env}".` },
      { status: 400 },
    );
  }

  const value = parsed.data.value?.trim() || null;
  await putSetting(parsed.data.env, value);

  const body: SettingsResponse = {
    credentials: describeCredentials(),
    brand: { iconUrl: await getBrandIconUrl() },
  };

  return NextResponse.json(body);
}
