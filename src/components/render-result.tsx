"use client";

import { useEffect, useState } from "react";
import { Ban, Download, ImageOff, Lasso, TriangleAlert, X } from "lucide-react";
import type { SerialisedRender } from "@/lib/jobs";
import { Badge, Button, Spinner } from "@/components/ui";
import { CompareSlider } from "@/components/compare-slider";
import { RegionEditDialog } from "@/components/region-edit-dialog";
import type { ProviderInfo } from "@/components/control-panel";
import { cn, downloadImage, formatDuration, renderFilename } from "@/lib/utils";
import { toast } from "sonner";

export function RenderResult({
  render,
  sourceUrl,
  providers = [],
  onEdited,
}: {
  render: SerialisedRender | null;
  sourceUrl: string | null;
  /** Engines available for a region edit. */
  providers?: ProviderInfo[];
  /** Fired when a region edit finishes, so the studio can show the result. */
  onEdited?: (result: SerialisedRender) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // The job writes its own terminal state, so this only asks for the stop — the
  // poll already running in the studio reports the outcome.
  const cancel = async () => {
    if (!render) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/render/${render.id}/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Không huỷ được.");
      }
      toast.success("Đã gửi lệnh huỷ.");
    } catch (error) {
      setCancelling(false);
      toast.error(error instanceof Error ? error.message : "Không huỷ được.");
    }
  };

  const running = render?.status === "pending" || render?.status === "running";

  // Both `selected` and `elapsed` reset by remount: the parent keys this
  // component on render.id, so a new job starts with fresh state and no
  // setState-in-effect cascade is needed.
  //
  // A live counter is the only honest progress signal — the providers report
  // queue position and log lines, not a percentage.
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 200);
    return () => clearInterval(timer);
  }, [running]);

  if (!render) {
    return (
      <EmptyState
        icon={<ImageOff className="h-7 w-7" />}
        title={sourceUrl ? "Sẵn sàng render" : "Chưa có ảnh nguồn"}
        body={
          sourceUrl
            ? "Chọn phong cách bên trái rồi bấm Render."
            : "Tải lên một ảnh sketch, ảnh 3D hoặc mặt đứng để bắt đầu."
        }
      />
    );
  }

  if (running) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        {sourceUrl ? (
          <div className="shimmer relative overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceUrl}
              alt="Ảnh nguồn đang xử lý"
              className="block max-h-[45vh] w-auto opacity-35"
            />
          </div>
        ) : null}

        <div className="flex items-center gap-2.5 text-sm">
          <Spinner size={36} />
          <span>{render.message ?? "Đang xử lý…"}</span>
          <span className="tnum font-mono text-xs text-ink-500">
            {(elapsed / 1000).toFixed(1)}s
          </span>
        </div>

        <Button size="sm" disabled={cancelling} onClick={cancel}>
          <X className="h-3.5 w-3.5" />
          {cancelling ? "Đang huỷ…" : "Huỷ"}
        </Button>
      </div>
    );
  }

  if (render.status === "cancelled") {
    return (
      <EmptyState
        icon={<Ban className="h-7 w-7" />}
        title="Đã huỷ"
        body={render.error ?? "Lần render này đã bị dừng."}
      />
    );
  }

  if (render.status === "failed") {
    return (
      <EmptyState
        icon={<TriangleAlert className="h-7 w-7 text-danger" />}
        title="Render thất bại"
        body={render.error ?? "Không rõ nguyên nhân."}
        tone="danger"
      />
    );
  }

  const outputs = render.outputUrls;
  if (outputs.length === 0) {
    return (
      <EmptyState
        icon={<ImageOff className="h-7 w-7" />}
        title="Không có ảnh kết quả"
        body="Provider báo thành công nhưng không trả về ảnh nào."
      />
    );
  }

  const current = outputs[Math.min(selected, outputs.length - 1)];

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
      <CompareSlider
        beforeUrl={render.sourceUrl}
        afterUrl={current}
        className="mx-auto w-full max-w-4xl"
      />

      {outputs.length > 1 ? (
        <div className="mx-auto flex w-full max-w-4xl gap-2">
          {outputs.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setSelected(index)}
              className={cn(
                "h-16 w-16 overflow-hidden rounded-md border-2 transition-colors",
                index === selected
                  ? "border-action"
                  : "border-border hover:border-ink-300",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Kết quả ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={async () => {
            try {
              await downloadImage(current, renderFilename(render, selected));
              toast.success("Đã tải ảnh về máy.");
            } catch {
              toast.error("Không tải được ảnh.");
            }
          }}
        >
          <Download className="h-4 w-4" />
          Tải ảnh về
        </Button>

        {providers.some((p) => p.configured) ? (
          <Button
            onClick={() => setEditing(true)}
            title="Khoanh một vùng và chỉ sửa riêng vùng đó"
          >
            <Lasso className="h-4 w-4" />
            Sửa vùng
          </Button>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge tone="success">{formatDuration(render.durationMs)}</Badge>
          <Badge>{render.provider}</Badge>
          <Badge>
            {render.controlMode === "none" ? "img2img" : render.controlMode}
          </Badge>
          {render.seed !== null ? (
            <Badge className="font-mono">seed {render.seed}</Badge>
          ) : null}
          <Badge className="font-mono">
            {render.width}×{render.height}
          </Badge>
        </div>
      </div>

      {editing ? (
        <RegionEditDialog
          render={render}
          outputIndex={Math.min(selected, outputs.length - 1)}
          providers={providers}
          onClose={() => setEditing(false)}
          onDone={(result) => {
            setEditing(false);
            onEdited?.(result);
          }}
        />
      ) : null}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center">
      <div
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full",
          tone === "danger" ? "bg-danger-soft" : "bg-surface-2 text-ink-500",
        )}
      >
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-[12px] leading-relaxed break-words text-ink-500">
        {body}
      </p>
    </div>
  );
}
