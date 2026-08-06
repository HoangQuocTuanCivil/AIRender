"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Images, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Studio", icon: Sparkles },
  { href: "/history", label: "Thư viện", icon: Images },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="shrink-0 border-b border-border bg-surface/60 backdrop-blur">
      <div className="flex h-14 items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-[13px] font-bold text-white">
            AI
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            AIRender
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <span className="ml-auto text-xs text-muted">
          Render kiến trúc bằng AI
        </span>
      </div>
    </header>
  );
}
