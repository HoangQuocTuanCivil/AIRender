"use client";

import { useSyncExternalStore } from "react";
import { readTheme, subscribeToTheme, type ThemeMode } from "./theme";

const getServerSnapshot = (): ThemeMode => "light";

/**
 * The theme lives on <html>, written by the pre-paint script before React
 * exists — an external store. Reading it with useSyncExternalStore rather than
 * setState-in-an-effect gives React the correct server snapshot for hydration,
 * avoids a cascading render, and picks up changes made from anywhere.
 */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeToTheme, readTheme, getServerSnapshot);
}
