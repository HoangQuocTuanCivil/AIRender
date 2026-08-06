"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { SerialisedRender } from "@/lib/jobs";
import { Badge, Button, Field, Panel, Spinner, Textarea } from "@/components/ui";
import { MaskEditor, exportMask } from "@/components/mask-editor";
import type { ProviderInfo } from "@/components/control-panel";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 1500;

/**
 * Correct part of a finished render: paint the region, say what should change,
 * and everything outside the painted area is carried over from the original
 * untouched. The compositing that makes that true happens on the server; this
 * screen only produces the mask and the instruction.
 */
export function RegionEditDialog({
  render,
  outputIndex,
  providers,
  onClose,
  onDone,
}: {
  render: SerialisedRender;
  outputIndex: number;
  providers: ProviderInfo[];
  onClose: () => void;
  onDone: (result: SerialisedRender) => void;
}) {
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [hasMask, setHasMask] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Engines that can run an edit: anything configured. FLUX Fill is offered here
  // and nowhere else, because a mask is exactly what it needs.
  const usable = providers.filter((p) => p.configured);
  const [providerId, setProviderId] = useState(
    () =>
      usable.find((p) => p.understandsVietnamese)?.id ?? usable[0]?.id ?? "",
  );
  const engine = usable.find((p) => p.id === providerId);

  const imageUrl = render.outputUrls[outputIndex];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [onClose, busy]);

  const submit = async () => {
    if (!maskRef.current) return;
    if (!hasMask) {
      toast.error("Chưa khoanh vùng nào. Hãy tô vùng cần sửa.");
      return;
    }
    if (!instruction.trim()) {
      toast.error("Chưa nhập yêu cầu sửa.");
      return;
    }

    setBusy(true);
    setProgress("Đang tải vùng khoanh lên…");

    try {
      const blob = await exportMask(maskRef.current);
      if (!blob) throw new Error("Không xuất được vùng khoanh.");

      const form = new FormData();
      form.append("file", new File([blob], "mask.png", { type: "image/png" }));
      const uploaded = await fetch("/api/upload", {
        method: "POST",
        body: form,
      }).then((r) => r.json());
      if (uploaded.error) throw new Error(uploaded.error);

      const created = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: render.id,
          outputIndex,
          maskPath: uploaded.path,
          instruction: instruction.trim(),
          providerId,
        }),
      }).then((r) => r.json());
      if (created.error) throw new Error(created.error);

      setProgress("Đang xử lý…");
      pollRef.current = setInterval(async () => {
        try {
          const data: SerialisedRender = await fetch(
            `/api/render/${created.id}`,
            { cache: "no-store" },
          ).then((r) => r.json());

          setProgress(data.message ?? "Đang xử lý…");

          if (
            data.status === "succeeded" ||
            data.status === "failed" ||
            data.status === "cancelled"
          ) {
            if (pollRef.current) clearInterval(pollRef.current);
            setBusy(false);
            if (data.status === "succeeded") {
              toast.success("Đã sửa xong vùng đã chọn.");
              onDone(data);
            } else if (data.status === "cancelled") {
              toast.info(data.error ?? "Đã huỷ.");
            } else {
              toast.error(data.error ?? "Sửa vùng thất bại.");
            }
          }
        } catch {
          // Transient; the next tick retries.
        }
      }, POLL_INTERVAL_MS);
    } catch (error) {
      setBusy(false);
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra.");
    }
  };

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-6xl gap-4 overflow-hidden rounded-xl border border-border bg-surface p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
          <MaskEditor
            imageUrl={imageUrl}
            width={render.width}
            height={render.height}
            disabled={busy}
            maskRef={maskRef}
            onChange={({ hasMask }) => setHasMask(hasMask)}
          />
        </div>

        <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 text-sm font-semibold">Sửa theo vùng</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-ink-500 hover:text-ink-950 disabled:opacity-40"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Panel title="Engine">
            <div className="space-y-1.5">
              {usable.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setProviderId(item.id)}
                  title={item.blurb}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left transition-colors",
                    "disabled:pointer-events-none disabled:opacity-45",
                    providerId === item.id
                      ? "border-action bg-module-soft"
                      : "border-border bg-surface-2 hover:bg-hover",
                  )}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] font-medium">{item.label}</span>
                    {item.understandsVietnamese ? (
                      <Badge tone="success">hiểu tiếng Việt</Badge>
                    ) : null}
                    {item.supportsMask ? (
                      <Badge tone="info">nhận vùng khoanh</Badge>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Yêu cầu sửa">
            <Field
              label="Mô tả thay đổi"
              hint={
                engine?.understandsVietnamese
                  ? "Engine này hiểu tiếng Việt trực tiếp — cứ viết tiếng Việt."
                  : "Engine này không hiểu tiếng Việt. Câu lệnh sẽ được dịch tự động sang tiếng Anh trước khi render."
              }
            >
              <Textarea
                rows={5}
                value={instruction}
                disabled={busy}
                placeholder="Ví dụ: bỏ chiếc xe tải màu trắng, thay bằng mặt đường trống"
                onChange={(event) => setInstruction(event.target.value)}
              />
            </Field>

            <p className="rounded-md bg-surface-2 p-2.5 text-[11px] leading-relaxed text-ink-500">
              Chỉ vùng bạn tô mới được vẽ lại. Mọi pixel ngoài vùng đó được sao y
              nguyên từ ảnh hiện tại — không đi qua AI lần nào.
            </p>
          </Panel>

          <div className="mt-auto space-y-2">
            {busy ? (
              <p className="flex items-center gap-2 text-[11px] text-ink-500">
                <Spinner size={28} />
                {progress}
              </p>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busy || !hasMask || !instruction.trim()}
              onClick={submit}
            >
              <Sparkles className="h-4 w-4" />
              {busy ? "Đang sửa…" : "Sửa vùng đã chọn"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
