"use client";

import { useCallback, useRef, useState } from "react";
import { Brush, Eraser, RectangleHorizontal, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export type MaskTool = "brush" | "rect" | "eraser";

/**
 * Paints the region to be edited over a render.
 *
 * Two canvases sit on top of the image: one holds the committed mask, the other
 * previews the stroke or rectangle in progress. Painting into a separate layer is
 * what makes a rectangle draggable — it can be redrawn every mouse move without
 * repeatedly stamping into the real mask.
 *
 * The mask is kept at the image's true pixel size, not the size it happens to be
 * displayed at, so the server never has to guess a scale factor.
 */
export function MaskEditor({
  imageUrl,
  width,
  height,
  disabled,
  onChange,
  maskRef,
}: {
  imageUrl: string;
  /** True pixel size of the image being edited. */
  width: number;
  height: number;
  disabled?: boolean;
  /** Fired whenever the painted area changes. */
  onChange: (state: { hasMask: boolean }) => void;
  /** Owned by the parent so it can call `exportMask` when submitting. */
  maskRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<MaskTool>("brush");
  const [brushSize, setBrushSize] = useState(64);
  const [painting, setPainting] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  // Mirrors historyRef's depth: a ref cannot be read during render to decide
  // whether the undo button is enabled.
  const [canUndo, setCanUndo] = useState(false);

  // Snapshots for undo. Bounded — a full-size ImageData per step is heavy.
  const historyRef = useRef<ImageData[]>([]);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // Stable across renders (refs are), so the callbacks below can declare them
  // as dependencies instead of silently closing over a new function each time.
  const ctx = useCallback(
    () => maskRef.current?.getContext("2d", { willReadFrequently: true }),
    [maskRef],
  );
  const pctx = useCallback(() => previewRef.current?.getContext("2d"), []);

  /** Displayed pixels → image pixels. The canvas is scaled by CSS. */
  const toImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * width,
        y: ((clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height],
  );

  const pushHistory = useCallback(() => {
    const c = ctx();
    if (!c) return;
    historyRef.current.push(c.getImageData(0, 0, width, height));
    if (historyRef.current.length > 12) historyRef.current.shift();
    setCanUndo(true);
  }, [width, height, ctx]);

  const reportChange = useCallback(() => {
    const c = ctx();
    if (!c) return;
    const { data } = c.getImageData(0, 0, width, height);
    // Alpha channel only: the mask is drawn opaque white on a transparent canvas.
    let painted = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        painted = true;
        break;
      }
    }
    setHasMask(painted);
    onChange({ hasMask: painted });
  }, [width, height, onChange, ctx]);

  const clear = useCallback(() => {
    const c = ctx();
    if (!c) return;
    pushHistory();
    c.clearRect(0, 0, width, height);
    reportChange();
  }, [width, height, pushHistory, reportChange, ctx]);

  const undo = useCallback(() => {
    const c = ctx();
    const previous = historyRef.current.pop();
    if (!c || !previous) return;
    c.putImageData(previous, 0, 0);
    setCanUndo(historyRef.current.length > 0);
    reportChange();
  }, [reportChange, ctx]);

  const strokeTo = useCallback(
    (x: number, y: number) => {
      const c = ctx();
      if (!c) return;
      // Erasing punches a hole in the alpha channel rather than painting black,
      // which keeps "painted" meaning "alpha > 0" everywhere else.
      c.globalCompositeOperation =
        tool === "eraser" ? "destination-out" : "source-over";
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      c.fill();
      c.globalCompositeOperation = "source-over";
    },
    [tool, brushSize, ctx],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = toImageCoords(event.clientX, event.clientY);
    pushHistory();
    setPainting(true);
    startRef.current = { x, y };
    if (tool !== "rect") strokeTo(x, y);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!painting || disabled) return;
    const { x, y } = toImageCoords(event.clientX, event.clientY);

    if (tool === "rect") {
      const p = pctx();
      const start = startRef.current;
      if (!p || !start) return;
      p.clearRect(0, 0, width, height);
      p.fillStyle = "rgba(255,255,255,0.55)";
      p.fillRect(
        Math.min(start.x, x),
        Math.min(start.y, y),
        Math.abs(x - start.x),
        Math.abs(y - start.y),
      );
      return;
    }

    strokeTo(x, y);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (!painting) return;
    setPainting(false);

    const { x, y } = toImageCoords(event.clientX, event.clientY);
    const start = startRef.current;
    startRef.current = null;

    if (tool === "rect" && start) {
      const c = ctx();
      const p = pctx();
      p?.clearRect(0, 0, width, height);
      if (c) {
        c.fillStyle = "#ffffff";
        c.fillRect(
          Math.min(start.x, x),
          Math.min(start.y, y),
          Math.abs(x - start.x),
          Math.abs(y - start.y),
        );
      }
    }

    reportChange();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton
          active={tool === "brush"}
          disabled={disabled}
          onClick={() => setTool("brush")}
          icon={<Brush className="h-4 w-4" />}
          label="Cọ vẽ tự do"
        />
        <ToolButton
          active={tool === "rect"}
          disabled={disabled}
          onClick={() => setTool("rect")}
          icon={<RectangleHorizontal className="h-4 w-4" />}
          label="Khoanh khung chữ nhật"
        />
        <ToolButton
          active={tool === "eraser"}
          disabled={disabled}
          onClick={() => setTool("eraser")}
          icon={<Eraser className="h-4 w-4" />}
          label="Tẩy vùng đã tô"
        />

        {tool !== "rect" ? (
          <label
            className="ml-1 flex items-center gap-2 text-[11px] text-ink-500"
            title="Cỡ cọ"
          >
            <input
              type="range"
              min={8}
              max={240}
              step={4}
              value={brushSize}
              disabled={disabled}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24"
            />
            <span className="tnum w-8 font-mono">{brushSize}</span>
          </label>
        ) : null}

        <span className="flex-1" />

        <Button
          size="sm"
          className="w-9 px-0"
          disabled={disabled || !canUndo}
          onClick={undo}
          title="Hoàn tác nét vừa vẽ"
          aria-label="Hoàn tác nét vừa vẽ"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          className="w-9 px-0"
          disabled={disabled || !hasMask}
          onClick={clear}
          title="Xoá toàn bộ vùng đã khoanh"
          aria-label="Xoá toàn bộ vùng đã khoanh"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* The box is pinned to the image's aspect ratio and the image fills it
          exactly. With `object-contain` the picture would letterbox inside a
          differently-shaped box and the overlay would no longer line up with
          what the user sees — every stroke would land offset. */}
      <div
        ref={wrapRef}
        style={{
          aspectRatio: `${width} / ${height}`,
          maxWidth: `min(100%, calc(60vh * ${width} / ${height}))`,
        }}
        className={cn(
          "relative mx-auto w-full overflow-hidden rounded-[var(--radius-md)]",
          "border border-border bg-surface-2 touch-none",
          disabled ? "cursor-default" : "cursor-crosshair",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Ảnh cần sửa"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
        />
        {/* Canvases keep their true pixel resolution and are stretched by CSS
            onto the same box, so the exported mask needs no rescaling. */}
        <canvas
          ref={maskRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-50 mix-blend-screen"
        />
        <canvas
          ref={previewRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
        />
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500">
        Tô lên phần cần sửa. Vùng sáng là phần AI được phép vẽ lại — mọi pixel
        ngoài vùng này được giữ nguyên từ ảnh gốc.
      </p>
    </div>
  );
}

/**
 * Icon-only, with the name on hover. A toolbar of five labelled buttons ate the
 * width the canvas needs; the icons are the standard drawing metaphors, and the
 * tooltip plus aria-label keep them discoverable and reachable by screen reader.
 */
function ToolButton({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-[var(--radius-control)] border",
        "transition-colors disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-action bg-module-soft text-ink-950"
          : "border-border bg-surface-2 text-ink-500 hover:bg-hover hover:text-ink-950",
      )}
    >
      {icon}
    </button>
  );
}

/**
 * Exports the painted mask as an opaque black/white PNG — white where the edit
 * applies. Transparent canvases are flattened onto black first, because an
 * endpoint reading a mask with an alpha channel can interpret it either way.
 */
export async function exportMask(
  canvas: HTMLCanvasElement,
): Promise<Blob | null> {
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const c = flat.getContext("2d");
  if (!c) return null;

  c.fillStyle = "#000000";
  c.fillRect(0, 0, flat.width, flat.height);
  c.drawImage(canvas, 0, 0);

  return new Promise((resolve) => flat.toBlob(resolve, "image/png"));
}
