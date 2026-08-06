"use client";

import { useCallback, useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";
import { cn, readImageSize } from "@/lib/utils";

export interface SourceImage {
  /** Storage-relative path returned by /api/upload. */
  path: string;
  /** Same-origin URL for previewing. */
  url: string;
  width: number;
  height: number;
  name: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

export function ImageDropzone({
  value,
  onChange,
  disabled,
}: {
  value: SourceImage | null;
  onChange: (image: SourceImage | null) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        // Read dimensions client-side so the server needs no image decoder.
        const size = await readImageSize(file);

        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/upload", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Upload thất bại.");

        onChange({
          path: data.path,
          url: data.url,
          width: size.width,
          height: size.height,
          name: file.name,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload thất bại.");
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) void upload(file);
    },
    [upload],
  );

  if (value) {
    return (
      <div className="space-y-2">
        <div className="group relative overflow-hidden rounded-lg border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.url}
            alt={value.name}
            className="block max-h-56 w-full object-contain"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-background/80 text-muted opacity-0 backdrop-blur transition hover:text-foreground group-hover:opacity-100"
              aria-label="Xoá ảnh nguồn"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-muted">
          {value.name} · {value.width}×{value.height}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg",
          "border border-dashed border-border bg-surface-2/40 px-4 text-center transition-colors",
          dragging && "border-accent bg-accent/5",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <p className="text-xs text-muted">Đang tải lên…</p>
          </>
        ) : (
          <>
            <ImageUp className="h-6 w-6 text-muted" />
            <p className="text-[13px] font-medium">Kéo thả ảnh vào đây</p>
            <p className="text-[11px] leading-relaxed text-muted">
              Sketch, ảnh 3D SketchUp/Revit, mặt đứng CAD…
              <br />
              JPG · PNG · WebP · AVIF — tối đa 20 MB
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
