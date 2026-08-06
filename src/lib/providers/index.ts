import { falProvider } from "./fal";
import { falFillProvider } from "./fal-fill";
import { googleProvider } from "./google";
import { nanoBananaProvider } from "./nano-banana";
import { replicateProvider } from "./replicate";
import { ProviderError, type RenderProvider } from "./types";

export * from "./types";

/** Registration order doubles as preference order when auto-selecting. */
const PROVIDERS: RenderProvider[] = [
  falProvider,
  nanoBananaProvider,
  falFillProvider,
  googleProvider,
  replicateProvider,
];

export function listProviders(): RenderProvider[] {
  return PROVIDERS;
}

export function getProvider(id: string): RenderProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * Resolve the provider to use for a request.
 *
 * An explicit id wins (and errors loudly if unconfigured, so the user gets a
 * real message instead of a silent switch). Otherwise fall back to
 * RENDER_PROVIDER, then to the first provider with credentials present.
 */
export function resolveProvider(preferredId?: string): RenderProvider {
  // These throw ProviderError (not Error) so the API routes answer 400 — a
  // missing key is the caller's config problem, not a server fault.
  if (preferredId) {
    const chosen = getProvider(preferredId);
    if (!chosen) {
      throw new ProviderError(
        `Provider không tồn tại: "${preferredId}"`,
        preferredId,
      );
    }
    return chosen;
  }

  const fromEnv = process.env.RENDER_PROVIDER;
  if (fromEnv) {
    const chosen = getProvider(fromEnv);
    if (chosen) return chosen;
  }

  const configured = PROVIDERS.find((p) => p.isConfigured());
  if (!configured) {
    throw new ProviderError(
      "Chưa cấu hình provider nào. Thêm API key ở mục Cài đặt (FAL_KEY, GEMINI_API_KEY hoặc REPLICATE_API_TOKEN).",
      "none",
    );
  }
  return configured;
}

/** Shape sent to the client so the UI can show which backends are live. */
export function describeProviders() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    blurb: p.blurb,
    configured: p.isConfigured(),
    supportsControlNet: p.supportsControlNet,
    supportsMask: p.supportsMask ?? false,
    editOnly: p.editOnly ?? false,
    understandsVietnamese: p.understandsVietnamese ?? false,
    promptStyle: p.promptStyle,
    apiKeyEnv: p.apiKeyEnv,
    apiKeyUrl: p.apiKeyUrl,
  }));
}
