"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Component idiom ported from vcc-platform:
 *   Button  — flat, no shadow, 7px radius, weight 600; secondary is outlined on
 *             the surface colour, never filled.
 *   Panel   — surface + 1px hairline border + 8px radius + exactly one shadow
 *             layer. The platform's guideline is explicit: minimal shadow, no
 *             glassmorphism in workspace chrome.
 *   Chip    — borderless, dot-prefixed, 6px radius, 12px/700.
 */

export function Button({
  children,
  className,
  variant = "default",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold",
        "transition-colors disabled:pointer-events-none disabled:opacity-45",
        // Platform control heights: 34 compact / 40 default.
        size === "sm" && "h-[34px] px-2.5 text-xs",
        size === "md" && "h-10 px-3.5 text-[13px]",
        size === "lg" && "h-11 px-5 text-[14px]",
        variant === "default" &&
          "border border-ink-300 bg-surface text-ink-800 hover:bg-hover",
        variant === "primary" && "bg-action text-white hover:bg-action-hover",
        variant === "ghost" && "text-ink-500 hover:bg-hover hover:text-ink-950",
        variant === "danger" &&
          "border border-danger/35 bg-danger-soft text-danger hover:brightness-95",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-semibold text-ink-800">{label}</label>
      {children}
      {hint ? (
        <p className="text-[11px] leading-relaxed text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  format = (v) => v.toFixed(2),
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  format?: (value: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold text-ink-800">{label}</label>
        <span className="tnum font-mono text-[11px] text-ink-500">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? (
        <p className="text-[11px] leading-relaxed text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Loading ring — see `.vx-spin` in globals.css. Takes the rail colour chosen in
 * Cài đặt; pass `inherit` when it sits on a filled button, where the surface
 * already dictates the readable colour.
 */
export function Spinner({
  size = 40,
  inherit = false,
  className,
  label = "Đang tải",
}: {
  size?: number;
  inherit?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("vx-spin", inherit && "vx-spin--inherit", className)}
      style={
        {
          width: size,
          height: size,
          // Stroke scales with the ring: 3px on a 24px ring is the reference
          // weight, and a fixed 3px on a 14px ring reads as a filled disc.
          "--vx-spin-w": `${Math.max(2, Math.round(size / 8))}px`,
        } as React.CSSProperties
      }
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3",
        "text-[13px] text-ink-950 placeholder:text-ink-400",
        "focus:border-action focus:outline-none focus:ring-3 focus:ring-brand-500/18",
        className,
      )}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full resize-y rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2",
        "text-[13px] leading-relaxed text-ink-950 placeholder:text-ink-400",
        "focus:border-action focus:outline-none focus:ring-3 focus:ring-brand-500/18",
        className,
      )}
    />
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-3.5 rounded-[var(--radius-md)] border border-border bg-surface p-4 shadow-e1",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-bold tracking-[0.02em] text-ink-700 uppercase">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Status chip. Borderless with a leading dot, matching the platform's
 * `.ant-tag::before` treatment — the dot carries the semantic colour so the
 * label stays readable at 11–12px.
 */
export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "action" | "success" | "warning" | "danger" | "info";
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-0.5",
        "text-[11px] font-bold leading-[1.33]",
        tone === "neutral" && "bg-surface-2 text-ink-700",
        tone === "action" && "bg-brand-100 text-brand-800",
        tone === "success" && "bg-success-soft text-success",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "info" && "bg-info-soft text-info",
        className,
      )}
    >
      {dot ? (
        <span className="h-[6px] w-[6px] flex-none rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

/** Section heading used above a group of panels. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 text-[15px] font-extrabold text-brand-800">{children}</h2>
  );
}
