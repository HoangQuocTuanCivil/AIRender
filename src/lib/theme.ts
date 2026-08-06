// Deliberately not a "use client" module: layout.tsx (a server component) imports
// THEME_INIT_SCRIPT from here, and a client-boundary module would hand it a
// client reference instead of the string. The React hook lives in use-theme.ts.

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "airender.theme";

/**
 * Runs before first paint, inlined in <head>. Without it the page renders in the
 * default light theme for one frame and then snaps to dark — the classic flash.
 *
 * Mirrors vcc-platform's hook: `data-vx-dark="1"` on <html>. That attribute sits
 * on the root element, so it also reaches portalled content (dialogs, toasts)
 * which a class on a wrapper div would miss.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.vxDark = dark ? "1" : "0";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.vxDark = "0";
  }
})();
`.trim();

export function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark";
  document.documentElement.dataset.vxDark = dark ? "1" : "0";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Private browsing — the theme just will not persist.
  }
}

export function readTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.vxDark === "1" ? "dark" : "light";
}

/** Subscribe to theme changes made anywhere in the app. */
export function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-vx-dark"],
  });
  return () => observer.disconnect();
}
