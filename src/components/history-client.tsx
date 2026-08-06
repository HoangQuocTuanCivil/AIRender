"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  Images,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { SerialisedRender } from "@/lib/jobs";
import { getContext, getLighting, getSubject } from "@/lib/presets";
import { Badge, Button } from "@/components/ui";
import { CompareSlider } from "@/components/compare-slider";
import { cn, downloadImage, formatDuration, formatRelativeTime } from "@/lib/utils";

export function HistoryClient() {
  const [items, setItems] = useState<SerialisedRender[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [preview, setPreview] = useState<SerialisedRender | null>(null);

  const load = useCallback(
    async (opts: { cursor?: string | null; favorites: boolean }) => {
      const params = new URLSearchParams();
      if (opts.cursor) params.set("cursor", opts.cursor);
      if (opts.favorites) params.set("favorites", "1");

      const response = await fetch(`/api/history?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Không tải được thư viện.");
      return (await response.json()) as {
        items: SerialisedRender[];
        nextCursor: string | null;
      };
    },
    [],
  );

  // `loading` is switched on by the filter toggle (an event), never
  // synchronously inside this effect — that would cascade renders.
  useEffect(() => {
    let cancelled = false;

    load({ favorites: onlyFavorites })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setCursor(data.nextCursor);
      })
      .catch(() => {
        if (!cancelled) toast.error("Không tải được thư viện.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [load, onlyFavorites]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const data = await load({ cursor, favorites: onlyFavorites });
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      toast.error("Không tải thêm được.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFavorite = async (item: SerialisedRender) => {
    const next = !item.favorite;
    // Optimistic: the star should feel instant.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, favorite: next } : i)),
    );
    setPreview((p) => (p?.id === item.id ? { ...p, favorite: next } : p));

    try {
      const response = await fetch(`/api/history/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: next }),
      });
      if (!response.ok) throw new Error();
      if (onlyFavorites && !next) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, favorite: !next } : i)),
      );
      toast.error("Không cập nhật được.");
    }
  };

  const remove = async (item: SerialisedRender) => {
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setPreview((p) => (p?.id === item.id ? null : p));

    try {
      const response = await fetch(`/api/history/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      toast.success("Đã xoá.");
    } catch {
      setItems(snapshot);
      toast.error("Không xoá được.");
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-3">
        <h1 className="text-[19px] leading-[1.25] font-bold text-ink-950">
          Thư viện render
        </h1>
        <span className="text-[12.5px] text-ink-500">{items.length} mục</span>

        <div className="ml-auto flex gap-1.5">
          <Button
            variant={onlyFavorites ? "primary" : "default"}
            size="sm"
            onClick={() => {
              setLoading(true);
              setOnlyFavorites((v) => !v);
            }}
          >
            <Star
              className={cn("h-3.5 w-3.5", onlyFavorites && "fill-current")}
            />
            Yêu thích
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-500">
            <Images className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium">
            {onlyFavorites ? "Chưa có mục yêu thích" : "Thư viện đang trống"}
          </p>
          <p className="max-w-sm text-[12px] leading-relaxed text-ink-500">
            {onlyFavorites
              ? "Bấm ngôi sao trên một render để ghim nó vào đây."
              : "Mọi lần render sẽ tự động được lưu lại ở đây."}
          </p>
          {!onlyFavorites ? (
            <Link href="/">
              <Button variant="primary" size="sm" className="mt-1">
                Tới Studio
              </Button>
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 p-5">
            {items.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onOpen={() => setPreview(item)}
                onToggleFavorite={() => toggleFavorite(item)}
                onDelete={() => remove(item)}
              />
            ))}
          </div>

          {cursor ? (
            <div className="flex justify-center pb-8">
              <Button onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Tải thêm
              </Button>
            </div>
          ) : null}
        </>
      )}

      {preview ? (
        <PreviewModal
          item={preview}
          onClose={() => setPreview(null)}
          onToggleFavorite={() => toggleFavorite(preview)}
          onDelete={() => remove(preview)}
        />
      ) : null}
    </div>
  );
}

function HistoryCard({
  item,
  onOpen,
  onToggleFavorite,
  onDelete,
}: {
  item: SerialisedRender;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const thumb = item.outputUrls[0] ?? item.sourceUrl;
  const failed = item.status === "failed";
  const subject = getSubject(item.presetId);
  const context = getContext(item.contextId);
  const lighting = getLighting(item.lightingId);

  return (
    <div className="group overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-e1">
      <button
        type="button"
        onClick={onOpen}
        disabled={failed}
        className="relative block aspect-4/3 w-full overflow-hidden bg-surface-2 disabled:cursor-default"
      >
        {failed ? (
          <span className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
            <TriangleAlert className="h-5 w-5 text-danger" />
            <span className="line-clamp-3 text-[10px] leading-relaxed text-ink-500">
              {item.error ?? "Thất bại"}
            </span>
          </span>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt={item.prompt.slice(0, 60)}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {item.outputUrls.length > 1 ? (
              <span className="absolute right-2 top-2 rounded bg-surface/80 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
                ×{item.outputUrls.length}
              </span>
            ) : null}
          </>
        )}
      </button>

      <div className="space-y-2 p-2.5">
        <div className="flex items-start gap-1.5">
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium">
            {subject?.name ?? "Tuỳ chỉnh"}
          </p>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={item.favorite ? "Bỏ yêu thích" : "Yêu thích"}
            className={cn(
              "shrink-0 transition-colors",
              item.favorite
                ? "text-amber-400"
                : "text-ink-500 opacity-0 group-hover:opacity-100 hover:text-ink-950",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", item.favorite && "fill-current")} />
          </button>
        </div>

        {context || lighting ? (
          <p className="truncate text-[10px] leading-relaxed text-ink-500">
            {[context?.name, lighting?.name].filter(Boolean).join(" · ")}
          </p>
        ) : (
          <p className="line-clamp-2 text-[10px] leading-relaxed text-ink-500">
            {item.prompt}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-500">
            {formatRelativeTime(item.createdAt)}
          </span>
          <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Link href={`/?from=${item.id}`} title="Render lại với tham số này">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:text-danger"
              onClick={onDelete}
              title="Xoá"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  item,
  onClose,
  onToggleFavorite,
  onDelete,
}: {
  item: SerialisedRender;
  onClose: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const current = item.outputUrls[selected] ?? item.sourceUrl;
  const subject = getSubject(item.presetId);
  const context = getContext(item.contextId);
  const lighting = getLighting(item.lightingId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-6xl gap-4 overflow-hidden rounded-xl border border-border bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <CompareSlider beforeUrl={item.sourceUrl} afterUrl={current} />

          {item.outputUrls.length > 1 ? (
            <div className="flex gap-2">
              {item.outputUrls.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSelected(index)}
                  className={cn(
                    "h-14 w-14 overflow-hidden rounded-md border-2 transition-colors",
                    index === selected ? "border-action" : "border-border",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
              {subject?.name ?? "Tuỳ chỉnh"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-500 hover:text-ink-950"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge tone="success">{formatDuration(item.durationMs)}</Badge>
            <Badge>{item.provider}</Badge>
            <Badge>
              {item.controlMode === "none" ? "img2img" : item.controlMode}
            </Badge>
            <Badge className="font-mono">
              {item.width}×{item.height}
            </Badge>
            <Badge className="font-mono">≤{item.maxSide}px</Badge>
          </div>

          <div className="space-y-2 rounded-md bg-surface-2 p-2.5">
            {context ? <Detail label="Bối cảnh" value={context.name} /> : null}
            {lighting ? <Detail label="Ánh sáng" value={lighting.name} /> : null}
            <Detail label="Prompt" value={item.prompt} mono />
            {item.negativePrompt ? (
              <Detail label="Negative" value={item.negativePrompt} mono />
            ) : null}
            <Detail label="Model" value={item.model} mono />
            <Detail label="Độ bám hình khối" value={item.controlStrength.toFixed(2)} />
            <Detail label="Mức biến đổi" value={item.strength.toFixed(2)} />
            <Detail label="Guidance" value={item.guidanceScale.toFixed(1)} />
            <Detail label="Steps" value={String(item.steps)} />
            <Detail label="Seed" value={item.seed !== null ? String(item.seed) : "ngẫu nhiên"} mono />
            <Detail label="Thời điểm" value={formatRelativeTime(item.createdAt)} />
          </div>

          <div className="mt-auto flex flex-col gap-1.5">
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await downloadImage(
                    current,
                    `airender-${item.id.slice(0, 8)}-${selected + 1}.${item.outputFormat}`,
                  );
                } catch {
                  toast.error("Không tải được ảnh.");
                }
              }}
            >
              <Download className="h-4 w-4" />
              Tải ảnh về
            </Button>

            <Link href={`/?from=${item.id}`} className="contents">
              <Button className="w-full">
                <RefreshCw className="h-4 w-4" />
                Render lại với tham số này
              </Button>
            </Link>

            <div className="flex gap-1.5">
              <Button className="flex-1" onClick={onToggleFavorite}>
                <Star
                  className={cn(
                    "h-4 w-4",
                    item.favorite && "fill-current text-amber-400",
                  )}
                />
                {item.favorite ? "Bỏ ghim" : "Ghim"}
              </Button>
              <Button variant="danger" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-400">{label}</p>
      <p
        className={cn(
          "text-[11px] leading-relaxed break-words text-ink-950",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}
