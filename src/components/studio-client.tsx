"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import type { SerialisedRender } from "@/lib/jobs";
import { ImageDropzone, type SourceImage } from "@/components/image-dropzone";
import {
  ControlPanel,
  DEFAULT_SETTINGS,
  type RenderSettings,
} from "@/components/control-panel";
import { RenderResult } from "@/components/render-result";
import { Button, Panel } from "@/components/ui";

interface ProviderInfo {
  id: string;
  label: string;
  configured: boolean;
  apiKeyEnv: string;
  apiKeyUrl: string;
}

const POLL_INTERVAL_MS = 1200;

export function StudioClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [source, setSource] = useState<SourceImage | null>(null);
  const [settings, setSettings] = useState<RenderSettings>(DEFAULT_SETTINGS);
  const [render, setRender] = useState<SerialisedRender | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers))
      .catch(() => setProviders([]));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/render/${id}`, {
            cache: "no-store",
          });
          if (!response.ok) return;
          const data: SerialisedRender = await response.json();
          setRender(data);

          if (data.status === "succeeded" || data.status === "failed") {
            stopPolling();
            setSubmitting(false);
            if (data.status === "succeeded") {
              toast.success("Render xong!");
            } else {
              toast.error(data.error ?? "Render thất bại.");
            }
          }
        } catch {
          // Transient network blip — the next tick retries.
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  useEffect(() => stopPolling, [stopPolling]);

  /** "Render lại" from the library lands here with ?from=<renderId>. */
  const fromId = searchParams.get("from");
  const loadedFromRef = useRef<string | null>(null);

  useEffect(() => {
    if (!fromId || loadedFromRef.current === fromId) return;
    loadedFromRef.current = fromId;

    (async () => {
      try {
        const response = await fetch(`/api/render/${fromId}`);
        if (!response.ok) throw new Error();
        const data: SerialisedRender = await response.json();

        setSource({
          path: data.sourceUrl.replace(/^\/api\/files\//, ""),
          url: data.sourceUrl,
          width: data.width,
          height: data.height,
          name: "Ảnh từ thư viện",
        });
        setSettings({
          presetId: data.presetId ?? "custom",
          prompt: data.prompt,
          negativePrompt: data.negativePrompt ?? "",
          controlMode: data.controlMode,
          controlStrength: data.controlStrength,
          strength: data.strength,
          guidanceScale: data.guidanceScale,
          steps: data.steps,
          numImages: data.numImages,
          seed: data.seed,
          outputFormat: data.outputFormat as "jpeg" | "png",
        });
        toast.success("Đã nạp tham số từ thư viện.");
      } catch {
        toast.error("Không nạp được render từ thư viện.");
      } finally {
        router.replace("/");
      }
    })();
  }, [fromId, router]);

  const submit = async () => {
    if (!source) {
      toast.error("Cần tải lên ảnh nguồn trước.");
      return;
    }
    if (!settings.prompt.trim()) {
      toast.error("Prompt không được để trống.");
      return;
    }

    setSubmitting(true);
    setRender(null);

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePath: source.path,
          width: source.width,
          height: source.height,
          prompt: settings.prompt,
          negativePrompt: settings.negativePrompt || undefined,
          presetId:
            settings.presetId === "custom" ? undefined : settings.presetId,
          controlMode: settings.controlMode,
          controlStrength: settings.controlStrength,
          strength: settings.strength,
          guidanceScale: settings.guidanceScale,
          steps: settings.steps,
          numImages: settings.numImages,
          seed: settings.seed ?? undefined,
          outputFormat: settings.outputFormat,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không gửi được yêu cầu.");

      setRender({
        id: data.id,
        status: "pending",
        message: "Đang khởi tạo…",
      } as SerialisedRender);
      poll(data.id);
    } catch (error) {
      setSubmitting(false);
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra.");
    }
  };

  const busy = submitting || render?.status === "running" || render?.status === "pending";
  const noProviderConfigured =
    providers !== null && providers.length > 0 && !providers.some((p) => p.configured);

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-[360px] shrink-0 overflow-y-auto border-r border-border p-3">
        {noProviderConfigured ? <MissingKeyWarning providers={providers!} /> : null}

        <Panel title="Ảnh nguồn" className="mb-3">
          <ImageDropzone value={source} onChange={setSource} disabled={busy} />
        </Panel>

        <ControlPanel settings={settings} onChange={setSettings} disabled={busy} />

        <div className="sticky bottom-0 -mx-3 mt-3 border-t border-border bg-background/95 p-3 backdrop-blur">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={submit}
            disabled={busy || !source || noProviderConfigured}
          >
            <Sparkles className="h-4 w-4" />
            {busy ? "Đang render…" : "Render"}
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 min-w-0 flex-col">
        {/* Keying on the job id remounts on each new render, resetting the
            elapsed timer and selected thumbnail without an effect. */}
        <RenderResult
          key={render?.id ?? "empty"}
          render={render}
          sourceUrl={source?.url ?? null}
        />
      </div>
    </div>
  );
}

function MissingKeyWarning({ providers }: { providers: ProviderInfo[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[12px] font-medium text-foreground">
            Chưa cấu hình API key
          </p>
          <p className="text-[11px] leading-relaxed text-muted">
            Tạo file <code className="font-mono text-foreground">.env.local</code>{" "}
            ở thư mục gốc, thêm một trong các key sau rồi khởi động lại dev server:
          </p>
          <ul className="space-y-1">
            {providers.map((p) => (
              <li key={p.id} className="text-[11px]">
                <code className="font-mono text-accent">{p.apiKeyEnv}=…</code>{" "}
                <a
                  href={p.apiKeyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted underline underline-offset-2 hover:text-foreground"
                >
                  lấy key
                </a>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted hover:text-foreground"
          aria-label="Đóng"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
