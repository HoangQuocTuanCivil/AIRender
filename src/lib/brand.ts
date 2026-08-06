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

/**
 * Rail colours, taken from vcc-platform's THEME_COLORS so the two products can
 * be themed to the same palette.
 *
 * A fixed list rather than a free colour picker: the rail carries white icons,
 * and an arbitrary hex can land somewhere that leaves them unreadable. Even
 * these are darkened before use — see the `.vx-rail` rule in globals.css and the
 * platform's rule never to paint a raw user colour behind white text.
 */
export const RAIL_COLORS: { id: string; name: string; hex: string }[] = [
  { id: "default", name: "Mặc định", hex: "#111a46" },
  { id: "indigo", name: "Chàm", hex: "#2e2c7d" },
  { id: "navy", name: "Xanh hải quân", hex: "#12557e" },
  { id: "ocean", name: "Xanh biển", hex: "#5988df" },
  { id: "blue", name: "Xanh dương", hex: "#3e9bfe" },
  { id: "aqua", name: "Xanh ngọc", hex: "#4a9cc4" },
  { id: "teal", name: "Xanh mòng két", hex: "#2ba0a1" },
  { id: "green", name: "Xanh lá", hex: "#5db682" },
  { id: "purple", name: "Tím", hex: "#5368d0" },
  { id: "orange", name: "Cam", hex: "#e09620" },
  { id: "red", name: "Đỏ", hex: "#e05453" },
];

export const DEFAULT_RAIL_COLOR_ID = "default";

export function railColorById(id: string | null | undefined) {
  return RAIL_COLORS.find((c) => c.id === id) ?? RAIL_COLORS[0];
}
