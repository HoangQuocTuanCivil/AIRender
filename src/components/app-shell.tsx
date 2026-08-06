"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Images, Moon, Sparkles, Sun } from "lucide-react";
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
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = MODULES.find((m) => isActive(pathname, m.href)) ?? MODULES[0];

  return (
    <div
      className="vx-shell"
      // Only the accent itself. --module-soft is derived from this per theme in
      // globals.css; setting it inline would pin one theme's brightness and make
      // the selected-state text unreadable in the other.
      style={{ "--module": active.color } as React.CSSProperties}
    >
      <nav className="vx-rail" aria-label="Khu vực làm việc">
        <Link
          href="/"
          className="mb-2 grid h-9 w-9 flex-none place-items-center rounded-[var(--radius-control)] bg-white/10 text-[12px] font-bold tracking-tight text-white"
          aria-label="AIRender — trang chủ"
        >
          AI
        </Link>

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
        <AppHeader title={active.label} />
        <main className="flex min-h-0 flex-1 flex-col bg-page">{children}</main>
      </div>
    </div>
  );
}

function AppHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-5">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="truncate text-[15px] font-bold tracking-tight text-ink-950">
          AIRender
        </h1>
        <span className="hidden truncate text-[12.5px] text-ink-500 sm:block">
          {title} · Render hạ tầng bằng AI
        </span>
      </div>

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
      className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] border border-border text-ink-700 transition-colors hover:bg-hover hover:text-ink-950"
    >
      {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
