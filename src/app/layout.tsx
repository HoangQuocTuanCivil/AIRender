import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { getBrandIconUrl, getRailColorId } from "@/lib/settings";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// vcc-platform declares Inter in every font stack but never loads it, so its
// chrome silently falls back to Segoe UI. Load it properly here — and with the
// `vietnamese` subset, which Geist (the create-next-app default) does not carry.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

// Mono is used only for small numeric labels (seed, dimensions, file names), so
// preloading it competes with the real content for bandwidth and trips Chrome's
// "preloaded but not used" warning. Let it load on demand.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    "Biến ảnh 3D, sketch hoặc bản vẽ CAD của công trình đường bộ, đường sắt, cầu và hầm thành ảnh render chân thực bằng AI.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The icon and rail colour are settings, read through a synchronous SQLite
  // driver. Without this the queries would run during prerendering and the shell
  // would keep whatever was set at build time.
  await connection();
  const brandIconUrl = await getBrandIconUrl();
  const railColorId = await getRailColorId();

  return (
    <html
      lang="vi"
      data-vx-dark="0"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Must run before first paint; see src/lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Ad-blocker and antivirus extensions stamp attributes on <body> before
          React hydrates (bis_skin_checked, bis_register, __processed_*). Nothing
          we control, and harmless — but it makes React log a hydration mismatch
          on every load, which buries real warnings. */}
      <body suppressHydrationWarning className="min-h-full bg-page text-ink-950">
        <AppShell brandIconUrl={brandIconUrl} railColorId={railColorId}>
          {children}
        </AppShell>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--ink-950)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-2)",
            },
          }}
        />
      </body>
    </html>
  );
}
