import { randomUUID } from "node:crypto";
import type { Render } from "@/generated/prisma";
import { prisma } from "./db";
import { getSubject } from "./presets";
import { resolveProvider, ProviderError, type ControlMode } from "./providers";
import { loadSettings } from "./settings";
import {
  RENDERS_DIR,
  contentTypeForPath,
  publicUrlFor,
  readStoredFile,
  saveRemoteImage,
} from "./storage";

export interface RenderRequestInput {
  sourcePath: string;
  width: number;
  height: number;
  prompt: string;
  extraDetails?: string;
  lanesPerDirection?: number | null;
  negativePrompt?: string;
  presetId?: string;
  contextId?: string;
  lightingId?: string;
  controlMode: ControlMode;
  controlStrength: number;
  strength: number;
  guidanceScale: number;
  steps: number;
  numImages: number;
  seed?: number;
  maxSide: number;
  outputFormat: "jpeg" | "png";
  providerId?: string;
}

export type JobStatus = "pending" | "running" | "succeeded" | "failed";

export interface LiveJob {
  id: string;
  status: JobStatus;
  /** Human-readable step, shown under the progress bar. */
  message: string;
  queuePosition?: number;
  startedAt: number;
}

/**
 * Live progress lives in memory (it is worthless after a restart); durable
 * state lives in SQLite. Held on globalThis so Next's dev-mode module reloading
 * does not orphan in-flight jobs.
 */
const globalForJobs = globalThis as unknown as {
  airenderJobs?: Map<string, LiveJob>;
};

const jobs: Map<string, LiveJob> =
  globalForJobs.airenderJobs ?? new Map<string, LiveJob>();
globalForJobs.airenderJobs = jobs;

export function getLiveJob(id: string): LiveJob | undefined {
  return jobs.get(id);
}

/**
 * Region edits run their own pipeline (`edit-jobs.ts`) but report progress
 * through the same registry, so `/api/render/[id]` polls both the same way.
 */
export function setLiveJob(id: string, job: LiveJob): void {
  jobs.set(id, job);
}

/** Kept briefly after a terminal state so the final poll still sees it. */
export function clearLiveJob(id: string, afterMs: number): void {
  setTimeout(() => jobs.delete(id), afterMs).unref?.();
}

/**
 * Create the DB row, kick off processing, and return immediately so the client
 * can poll. Rendering takes 20–90s; holding the HTTP request open that long
 * costs us progress reporting and trips proxy timeouts.
 */
export async function startRender(input: RenderRequestInput): Promise<string> {
  // Providers read credentials synchronously, so the stored keys have to be in
  // memory before one is resolved — and before the job runs, since it renders
  // long after this request has returned.
  await loadSettings();

  const provider = resolveProvider(input.providerId);
  if (!provider.isConfigured()) {
    throw new ProviderError(
      `Provider "${provider.label}" chưa có API key. Thêm ${provider.apiKeyEnv} ở mục Cài đặt.`,
      provider.id,
    );
  }

  const id = randomUUID();
  const subject = getSubject(input.presetId);

  await prisma.render.create({
    data: {
      id,
      status: "pending",
      provider: provider.id,
      model: provider.modelFor(input.controlMode),
      controlMode: input.controlMode,
      presetId: subject?.id ?? null,
      contextId: input.contextId ?? null,
      lightingId: input.lightingId ?? null,
      prompt: input.prompt,
      extraDetails: input.extraDetails || null,
      lanesPerDirection: input.lanesPerDirection ?? null,
      negativePrompt: input.negativePrompt || null,
      controlStrength: input.controlStrength,
      strength: input.strength,
      guidanceScale: input.guidanceScale,
      steps: input.steps,
      numImages: input.numImages,
      seed: input.seed != null ? String(input.seed) : null,
      width: input.width,
      height: input.height,
      maxSide: input.maxSide,
      outputFormat: input.outputFormat,
      sourcePath: input.sourcePath,
      outputPaths: "[]",
    },
  });

  jobs.set(id, {
    id,
    status: "pending",
    message: "Đang chuẩn bị ảnh nguồn…",
    startedAt: Date.now(),
  });

  // Deliberately not awaited: the route returns the id right away.
  void processRender(id, input, provider).catch((error) => {
    console.error(`[render ${id}] uncaught`, error);
  });

  return id;
}

async function processRender(
  id: string,
  input: RenderRequestInput,
  provider: ReturnType<typeof resolveProvider>,
) {
  const startedAt = Date.now();
  const update = (patch: Partial<LiveJob>) => {
    const current = jobs.get(id);
    if (current) jobs.set(id, { ...current, ...patch });
  };

  try {
    update({ status: "running", message: "Đang tải ảnh nguồn lên provider…" });
    await prisma.render.update({
      where: { id },
      data: { status: "running" },
    });

    const buffer = await readStoredFile(input.sourcePath);
    const mime = contentTypeForPath(input.sourcePath);
    const imageUrl = await provider.prepareImage(buffer, mime);

    update({ message: "Đã gửi yêu cầu, đang chờ hàng đợi…" });

    const outcome = await provider.render(
      {
        imageUrl,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        controlMode: input.controlMode,
        controlStrength: input.controlStrength,
        strength: input.strength,
        guidanceScale: input.guidanceScale,
        steps: input.steps,
        numImages: input.numImages,
        seed: input.seed,
        imageSize: { width: input.width, height: input.height },
        maxSide: input.maxSide,
        outputFormat: input.outputFormat,
      },
      (event) => {
        if (event.type === "queued") {
          update({
            message:
              typeof event.position === "number"
                ? `Đang xếp hàng (vị trí ${event.position})…`
                : "Đang xếp hàng trên server…",
            queuePosition: event.position,
          });
        } else if (event.type === "progress") {
          update({ message: event.message, queuePosition: undefined });
        } else {
          update({ message: "Đang tải ảnh kết quả về máy…" });
        }
      },
    );

    update({ message: "Đang tải ảnh kết quả về máy…" });

    const outputPaths: string[] = [];
    for (const [index, image] of outcome.images.entries()) {
      outputPaths.push(
        await saveRemoteImage(
          RENDERS_DIR,
          image.url,
          image.contentType,
          `${id}-${index}`,
        ),
      );
    }

    await prisma.render.update({
      where: { id },
      data: {
        status: "succeeded",
        outputPaths: JSON.stringify(outputPaths),
        seed: formatSeed(outcome.seed ?? input.seed),
        model: outcome.model,
        durationMs: Date.now() - startedAt,
      },
    });

    update({ status: "succeeded", message: "Hoàn tất" });
  } catch (error) {
    const message =
      error instanceof ProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    console.error(`[render ${id}] failed:`, error);

    await prisma.render
      .update({
        where: { id },
        data: {
          status: "failed",
          error: message,
          durationMs: Date.now() - startedAt,
        },
      })
      .catch(() => {});

    update({ status: "failed", message });
  } finally {
    // Keep the entry around briefly so the final poll sees the terminal state.
    setTimeout(() => jobs.delete(id), 5 * 60_000).unref?.();
  }
}

/**
 * Shape returned to the client for both live polling and history listing.
 *
 * Takes Prisma's generated row type rather than a hand-written one, so adding a
 * column to the schema surfaces here as a type error instead of silently
 * dropping the field from the API response.
 */
export function serialiseRender(record: Render, live?: LiveJob) {
  let outputs: string[] = [];
  try {
    outputs = JSON.parse(record.outputPaths) as string[];
  } catch {
    outputs = [];
  }

  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    status: record.status as JobStatus,
    error: record.error,
    message: live?.message ?? null,
    queuePosition: live?.queuePosition ?? null,
    provider: record.provider,
    model: record.model,
    controlMode: record.controlMode as ControlMode,
    presetId: record.presetId,
    contextId: record.contextId,
    lightingId: record.lightingId,
    prompt: record.prompt,
    extraDetails: record.extraDetails,
    lanesPerDirection: record.lanesPerDirection,
    negativePrompt: record.negativePrompt,
    controlStrength: record.controlStrength,
    strength: record.strength,
    guidanceScale: record.guidanceScale,
    steps: record.steps,
    numImages: record.numImages,
    seed: record.seed,
    width: record.width,
    height: record.height,
    maxSide: record.maxSide,
    outputFormat: record.outputFormat,
    durationMs: record.durationMs,
    favorite: record.favorite,
    sourceUrl: publicUrlFor(record.sourcePath),
    outputUrls: outputs.map(publicUrlFor),

    // Region edit. `parentId` present means this render corrects an earlier one.
    parentId: record.parentId,
    maskUrl: record.maskPath ? publicUrlFor(record.maskPath) : null,
    editInstruction: record.editInstruction,
    editInstructionEn: record.editInstructionEn,
    editBox: record.editBox,
  };
}

/**
 * Providers hand back whatever their JSON carried. fal's seeds routinely exceed
 * Number.MAX_SAFE_INTEGER, at which point the value JavaScript holds is already
 * approximate — but it still has to be recorded and displayed, so keep it as
 * text and let `isReusableSeed` decide whether it can be fed back in.
 */
function formatSeed(seed: number | string | undefined | null): string | null {
  if (seed === undefined || seed === null) return null;
  return String(seed);
}

export type SerialisedRender = ReturnType<typeof serialiseRender>;
