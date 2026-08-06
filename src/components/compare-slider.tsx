"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Before/after wipe. The "after" image is clipped to the handle position, so
 * both images stay pixel-aligned regardless of container size — which is the
 * whole point when checking whether the AI kept the massing.
 */
export function CompareSlider({
  beforeUrl,
  afterUrl,
  className,
}: {
  beforeUrl: string;
  afterUrl: string;
  className?: string;
}) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  }, []);

  // Listeners go on window so the drag survives the cursor leaving the image.
  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => updateFromClientX(event.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateFromClientX]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative select-none overflow-hidden rounded-lg border border-border bg-surface-2",
        dragging ? "cursor-grabbing" : "cursor-ew-resize",
        className,
      )}
      onPointerDown={(event) => {
        setDragging(true);
        updateFromClientX(event.clientX);
      }}
    >
      {/* The render is the base layer and sizes the box, so it is what shows to
          the RIGHT of the handle — matching the "Render" label over there.
          `inset(0 X% 0 0)` clips from the right, so the clipped overlay is what
          appears on the LEFT; that has to be the source image. Having these the
          other way round is what made the two labels point at the wrong halves. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt="Ảnh render"
        draggable={false}
        className="block max-h-[70vh] w-full object-contain"
      />

      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {/* object-cover, not contain: providers do not always return the source
            aspect exactly (1024×576 in, 1376×768 back), and two contained images
            of different aspect letterbox independently — the wipe line then sits
            at a different point in each picture, which defeats the comparison.
            Filling the same box costs a fraction of a percent of crop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Ảnh gốc"
          draggable={false}
          className="block h-full w-full object-cover"
        />
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.6)]"
        style={{ left: `${position}%` }}
      >
        {/* Fixed dark scrim rather than a theme colour — this sits on top of the
            image, where the surrounding brightness is the render's, not the UI's. */}
        <div className="absolute top-1/2 left-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/55 backdrop-blur">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>

      <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-[var(--radius-sm)] bg-black/60 px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-white/85 uppercase backdrop-blur">
        Gốc
      </span>
      <span className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-[var(--radius-sm)] bg-black/60 px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-white uppercase backdrop-blur">
        Render
      </span>
    </div>
  );
}
