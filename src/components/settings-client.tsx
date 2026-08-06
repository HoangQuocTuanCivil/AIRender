"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ImageUp, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  CredentialInfo,
  SettingsResponse,
} from "@/app/api/settings/route";
import { APP_NAME, BRAND_INITIALS, MAX_ICON_BYTES } from "@/lib/brand";
import { Badge, Button, Input, Panel } from "@/components/ui";

/**
 * Configuration screen: the API keys the engines need, and the icon shown in the
 * rail. Keys entered here are stored in the local SQLite file and take effect on
 * the next render — no .env.local edit, no restart.
 */
export function SettingsClient() {
  const router = useRouter();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/settings", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<SettingsResponse>;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        if (!cancelled) toast.error("Không đọc được cài đặt.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-3">
        <h1 className="text-[19px] leading-[1.25] font-bold text-ink-950">
          Cài đặt
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-500" />
        </div>
      ) : !data ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px] text-ink-500">
          Không đọc được cài đặt. Tải lại trang để thử lại.
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
          <IconPanel
            iconUrl={data.brand.iconUrl}
            onChange={(iconUrl) => {
              setData({ ...data, brand: { iconUrl } });
              // The rail is rendered by the root layout on the server.
              router.refresh();
            }}
          />

          <Panel title="API key">
            <p className="text-[12px] leading-relaxed text-ink-500">
              Key được lưu trong file SQLite của ứng dụng (dạng chữ thường, không
              mã hoá) và có hiệu lực ngay ở lần render tiếp theo. Key nhập ở đây
              được ưu tiên hơn biến môi trường cùng tên trong{" "}
              <code className="font-mono text-ink-700">.env.local</code>.
            </p>

            <div className="space-y-3">
              {data.credentials.map((credential) => (
                <CredentialRow
                  key={credential.env}
                  credential={credential}
                  onSaved={(body) => setData(body)}
                />
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function IconPanel({
  iconUrl,
  onChange,
}: {
  iconUrl: string | null;
  onChange: (iconUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > MAX_ICON_BYTES) {
      toast.error(
        `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB). Tối đa ${MAX_ICON_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/settings/icon", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        iconUrl?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Không lưu được icon.");

      onChange(body.iconUrl ?? null);
      toast.success("Đã đổi icon ứng dụng.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được icon.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/settings/icon", { method: "DELETE" });
      if (!response.ok) throw new Error();
      onChange(null);
      toast.success("Đã khôi phục icon mặc định.");
    } catch {
      toast.error("Không khôi phục được icon.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Nhận diện ứng dụng">
      <div className="flex items-center gap-4">
        {/* Same dark surface as the rail, in both themes, so the preview shows
            the icon in the context it will actually appear in. */}
        <div className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-[var(--radius-md)] bg-rail text-[13px] font-bold tracking-tight text-white">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            BRAND_INITIALS
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[13px] font-semibold text-ink-950">{APP_NAME}</p>
          <p className="text-[11.5px] leading-relaxed text-ink-500">
            Icon hiển thị ở đầu thanh điều hướng bên trái. Ảnh vuông cho kết quả
            tốt nhất — PNG, JPG, WebP hoặc AVIF, tối đa{" "}
            {MAX_ICON_BYTES / 1024 / 1024} MB.
          </p>
        </div>

        <div className="flex flex-none gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so picking the same file twice still fires a change.
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageUp className="h-3.5 w-3.5" />
            )}
            Chọn ảnh
          </Button>
          {iconUrl ? (
            <Button size="sm" disabled={busy} onClick={() => void reset()}>
              <RotateCcw className="h-3.5 w-3.5" />
              Mặc định
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

const SOURCE_LABEL: Record<
  CredentialInfo["source"],
  { text: string; tone: "success" | "info" | "danger" }
> = {
  settings: { text: "đang dùng key ở đây", tone: "success" },
  env: { text: "đang dùng .env.local", tone: "info" },
  none: { text: "chưa có key", tone: "danger" },
};

function CredentialRow({
  credential,
  onSaved,
}: {
  credential: CredentialInfo;
  onSaved: (body: SettingsResponse) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const status = SOURCE_LABEL[credential.source];

  const submit = async (next: string | null) => {
    setBusy(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: credential.env, value: next }),
      });
      const body = (await response.json()) as SettingsResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Không lưu được key.");

      onSaved(body);
      setValue("");
      toast.success(next ? `Đã lưu ${credential.env}.` : `Đã xoá ${credential.env}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-[12px] font-semibold text-ink-950">
          {credential.env}
        </code>
        <Badge tone={status.tone} dot>
          {status.text}
        </Badge>
        {credential.masked ? (
          <span className="font-mono text-[11px] text-ink-500">
            {credential.masked}
          </span>
        ) : null}
        <a
          href={credential.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-ink-500 underline underline-offset-2 hover:text-ink-950"
        >
          Lấy key
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-500">
        Dùng cho: {credential.engines.join(" · ")}
      </p>

      <form
        className="flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) void submit(value.trim());
        }}
      >
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            credential.source === "none"
              ? "Dán key vào đây"
              : "Dán key mới để thay thế"
          }
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="font-mono"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !value.trim()}
          className="flex-none"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Lưu
        </Button>
        {credential.source === "settings" ? (
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            className="flex-none"
            title="Xoá key đã lưu, quay lại dùng biến môi trường nếu có"
            onClick={() => void submit(null)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </form>
    </div>
  );
}
