"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Images, Moon, Settings, Sparkles, Sun } from "lucide-react";
import { APP_NAME, BRAND_INITIALS, railColorById } from "@/lib/brand";
import { applyTheme } from "@/lib/theme";
import { useThemeMode } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

/**
 * Level-1 navigation, ported from vcc-platform's GlobalRail.
 *
 * Each entry owns a module colour used only at accent points — the rail icon and
 * its 3px indicator. The page background stays neutral (the platform's 80-15-5
 * rule); module colour is never used to signal status.
 */
const MODULES = [
  { key: "studio", href: "/", label: "Studio", icon: Sparkles, color: "#4c51bf" },
  {
    key: "library",
    href: "/history",
    label: "Thư viện",
    icon: Images,
    color: "#0078a8",
  },
  // Neutral slate rather than a third brand hue — but light enough to stay
  // legible as the icon colour and the 3px indicator on the dark navy rail.
  {
    key: "settings",
    href: "/settings",
    label: "Cài đặt",
    icon: Settings,
    color: "#6b7f9e",
  },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({
  children,
  brandIconUrl,
  railColorId,
}: {
  children: React.ReactNode;
  /** Icon uploaded in Cài đặt; null falls back to the initials badge. */
  brandIconUrl?: string | null;
  /** Rail colour chosen in Cài đặt. */
  railColorId?: string | null;
}) {
  const pathname = usePathname();
  const active = MODULES.find((m) => isActive(pathname, m.href)) ?? MODULES[0];
  const rail = railColorById(railColorId);

  return (
    <div
      className="vx-shell"
      // --module-soft is derived from --module per theme in globals.css; setting
      // it inline would pin one theme's brightness and make the selected-state
      // text unreadable in the other. --rail is likewise darkened in CSS rather
      // than here, so the chosen hue never lands raw behind white icons.
      style={
        {
          "--module": active.color,
          "--rail": rail.hex,
        } as React.CSSProperties
      }
    >
      <nav className="vx-rail" aria-label="Khu vực làm việc">
        {MODULES.map((module) => {
          const on = isActive(pathname, module.href);
          const Icon = module.icon;
          return (
            <Link
              key={module.key}
              href={module.href}
              className={cn("vx-rail-ic", on && "on")}
              style={on ? { color: module.color } : undefined}
              aria-label={module.label}
              aria-current={on ? "page" : undefined}
              title={module.label}
            >
              <Icon size={22} />
            </Link>
          );
        })}
      </nav>

      {/* min-h-0 is load-bearing: a grid item defaults to min-height:auto, so
          without it a tall sidebar stretches the row past 100dvh and the whole
          page scrolls instead of the panel. Same technique as the platform's
          full-height table chain. */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <AppHeader brandIconUrl={brandIconUrl} />
        <main className="flex min-h-0 flex-1 flex-col bg-page">{children}</main>
      </div>
    </div>
  );
}

function AppHeader({ brandIconUrl }: { brandIconUrl?: string | null }) {
  return (
    <header className="vx-head sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-5">
      {/* The plate reaches back over the rail column — see .vx-brand-plate. */}
      <Link
        href="/"
        className="vx-brand-plate"
        aria-label={`${APP_NAME} — trang chủ`}
        title={APP_NAME}
      >
        {brandIconUrl ? (
          // Contained, never cropped: a wordmark that loses its edges stops
          // being a logo. Height is fixed, width follows the aspect ratio.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brandIconUrl}
            alt=""
            className="h-[26px] w-auto max-w-[180px] object-contain"
          />
        ) : (
          <span className="text-[13px] font-extrabold tracking-tight">
            {BRAND_INITIALS}
          </span>
        )}
      </Link>

      {/* White, not --ink-950: the header now carries the bar colour, and ink
          follows the light/dark ramp — it would vanish in one of the two. */}
      <h1 className="truncate text-[15px] font-bold tracking-tight text-white">
        {APP_NAME}
      </h1>

      <span className="flex-1" />

      <ThemeToggle />
    </header>
  );
}

function ThemeToggle() {
  const mode = useThemeMode();

  const toggle = () => applyTheme(mode === "dark" ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      title={mode === "dark" ? "Giao diện sáng" : "Giao diện tối"}
      className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] border border-white/25 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
    >
      {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
