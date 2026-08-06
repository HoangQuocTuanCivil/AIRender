/**
 * Product identity. Kept free of any server import so client components can use
 * it directly — the icon itself is a setting and comes from `settings.ts`.
 */

export const APP_NAME = "A2ZRender";

export const APP_TAGLINE = "Render hạ tầng bằng AI";

/** Drawn in the rail badge when no icon has been uploaded in Cài đặt. */
export const BRAND_INITIALS = "A2Z";

/** Icons are small and square; anything larger is a photo pasted by mistake. */
export const MAX_ICON_BYTES = 2 * 1024 * 1024;
