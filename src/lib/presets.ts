import type { ControlMode } from "./providers/types";

export interface PresetDefaults {
  controlMode: ControlMode;
  /** 0..1 — how hard the control LoRA pins the source geometry. */
  controlStrength: number;
  /** 0..1 — 0 preserves the source, 1 fully remakes it. */
  strength: number;
  guidanceScale: number;
  steps: number;
}

export interface StylePreset {
  id: string;
  name: string;
  /** One-line description shown under the preset name. */
  description: string;
  group: "Ngoại thất" | "Nội thất" | "Cảnh quan & đô thị" | "Kỹ thuật";
  prompt: string;
  negativePrompt: string;
  defaults: PresetDefaults;
}

/** Appended to every preset prompt — the vocabulary that pushes FLUX toward
 *  photographic architectural output rather than illustration. */
const PHOTO_TAIL =
  "professional architectural photography, shot on full-frame camera, 24mm tilt-shift lens, " +
  "vertical lines perfectly corrected, high dynamic range, physically accurate lighting, " +
  "sharp focus throughout, ultra detailed materials, 8k";

const COMMON_NEGATIVE =
  "distorted perspective, warped straight lines, bent verticals, melting geometry, " +
  "extra floors, duplicated windows, unreadable text, watermark, signature, logo, " +
  "cartoon, illustration, painting, cgi render look, plastic materials, oversaturated, " +
  "blurry, low resolution, jpeg artifacts, people with deformed faces";

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "exterior-daylight",
    name: "Ngoại thất — ban ngày",
    description: "Nắng trong, trời xanh nhẹ, bóng đổ rõ. Preset an toàn nhất để bắt đầu.",
    group: "Ngoại thất",
    prompt: `Photorealistic exterior view of a modern building, clear midday daylight, soft blue sky with thin cirrus clouds, crisp directional sunlight casting well-defined shadows, natural concrete glass and wood facade materials with realistic reflections, subtle ambient occlusion, mature landscaping with native trees, a few pedestrians for scale, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.85,
      strength: 0.9,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "exterior-golden-hour",
    name: "Ngoại thất — hoàng hôn",
    description: "Nắng vàng xiên, kính phản chiếu ấm, đèn nội thất bắt đầu sáng.",
    group: "Ngoại thất",
    prompt: `Photorealistic exterior view of a modern building at golden hour, low warm sunlight raking across the facade, long soft shadows, dramatic orange and magenta gradient sky, warm interior lights glowing through the glazing, wet reflective pavement, atmospheric haze catching the light, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.85,
      strength: 0.9,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "exterior-dusk",
    name: "Ngoại thất — chạng vạng",
    description: "Blue hour: trời xanh thẫm, đèn công trình là nguồn sáng chính.",
    group: "Ngoại thất",
    prompt: `Photorealistic exterior of a modern building at blue hour dusk, deep indigo sky, architectural facade lighting and warm interior illumination as the dominant light sources, glowing glazing, light spill onto surrounding paving, subtle light trails from passing cars, calm balanced exposure between sky and building, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.88,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "interior-modern",
    name: "Nội thất — hiện đại",
    description: "Không gian sống hiện đại, ánh sáng tự nhiên từ cửa lớn.",
    group: "Nội thất",
    prompt: `Photorealistic modern interior, abundant natural daylight from floor-to-ceiling windows, soft indirect bounce light, warm oak flooring, matte plaster walls, designer furniture with realistic fabric texture, layered artificial lighting with warm accent lamps, styled with books plants and ceramics, clean uncluttered composition, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.88,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "interior-scandinavian",
    name: "Nội thất — Scandinavian",
    description: "Tối giản Bắc Âu: gỗ sáng, tường trắng, vải lanh, ánh sáng dịu.",
    group: "Nội thất",
    prompt: `Photorealistic Scandinavian minimalist interior, pale white oak floors, off-white lime-washed walls, natural linen and wool textiles, light birch furniture with slim profiles, soft diffused north light, restrained neutral palette with muted sage accents, a single sculptural pendant lamp, airy and calm atmosphere, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.88,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "interior-luxury",
    name: "Nội thất — cao cấp",
    description: "Vật liệu sang: đá marble, đồng, gỗ óc chó, ánh sáng ấm nhiều lớp.",
    group: "Nội thất",
    prompt: `Photorealistic luxury interior, book-matched marble surfaces with realistic veining, brushed brass and bronze detailing, dark walnut joinery, velvet upholstery, layered warm lighting with cove lights and sculptural fixtures, deep contrast with controlled highlights, refined and editorial composition, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.88,
      guidanceScale: 3.8,
      steps: 32,
    },
  },
  {
    id: "urban-context",
    name: "Phối cảnh đô thị",
    description: "Công trình đặt trong bối cảnh phố xá, có người và xe cộ.",
    group: "Cảnh quan & đô thị",
    prompt: `Photorealistic street-level urban view of a building in its city context, surrounding mid-rise buildings and street furniture, active sidewalk with pedestrians in motion blur, parked and passing vehicles, mature street trees, overcast-to-partly-cloudy diffused daylight, realistic urban materials and weathering, documentary composition, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.82,
      strength: 0.9,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "aerial-masterplan",
    name: "Phối cảnh tổng thể (aerial)",
    description: "Góc nhìn từ trên cao cho quy hoạch, khu đô thị, tổng mặt bằng.",
    group: "Cảnh quan & đô thị",
    prompt: `Photorealistic aerial drone view of a masterplan development, clear overview of building massing roads and open space, mature landscaping and tree canopies, realistic paving and roof materials, soft late-morning sunlight with gentle shadows, distant city skyline and atmospheric perspective, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.85,
      strength: 0.9,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "landscape-garden",
    name: "Cảnh quan sân vườn",
    description: "Tập trung vào cây xanh, mặt nước, lối đi, vật liệu ngoài trời.",
    group: "Cảnh quan & đô thị",
    prompt: `Photorealistic landscape architecture view, lush layered planting with accurate species variety, natural stone and timber decking, reflective water feature with gentle ripples, dappled sunlight filtering through tree canopy, integrated outdoor lighting, rich but natural greens, inviting human-scale composition, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.8,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "sketch-to-real",
    name: "Sketch → ảnh thật",
    description: "Dành cho nét vẽ tay hoặc line-art CAD. Dùng Canny để bám đường nét.",
    group: "Kỹ thuật",
    prompt: `Photorealistic architectural visualization built strictly from the underlying line drawing, faithful to every drawn edge and proportion, realistic material assignment for concrete glass steel and timber, natural daylight with accurate shadows, contextual landscaping and sky, ${PHOTO_TAIL}`,
    negativePrompt: `${COMMON_NEGATIVE}, visible sketch lines, pencil strokes, hatching, drawing paper texture, outline`,
    defaults: {
      controlMode: "canny",
      controlStrength: 0.95,
      strength: 0.95,
      guidanceScale: 3.5,
      steps: 34,
    },
  },
  {
    id: "clay-to-real",
    name: "Clay/3D → ảnh thật",
    description: "Cho ảnh chụp màn hình SketchUp/Revit chưa gán vật liệu.",
    group: "Kỹ thuật",
    prompt: `Photorealistic architectural visualization derived from an untextured clay 3D massing model, preserving the exact massing and camera, assigning believable real-world materials to each surface, realistic global illumination and soft shadows, contextual environment and sky, ${PHOTO_TAIL}`,
    negativePrompt: `${COMMON_NEGATIVE}, clay render, untextured grey surfaces, flat shading, viewport screenshot`,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.92,
      strength: 0.93,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "construction-progress",
    name: "Ảnh thi công thực tế",
    description: "Mô phỏng công trình đang xây: giàn giáo, cẩu, vật liệu tại chỗ.",
    group: "Kỹ thuật",
    prompt: `Photorealistic construction site photograph of the building under construction, exposed structural frame, scaffolding and safety netting, tower crane, stacked materials and site fencing, workers in high-visibility PPE, overcast working daylight, authentic dust and site texture, documentary photojournalism style, ${PHOTO_TAIL}`,
    negativePrompt: COMMON_NEGATIVE,
    defaults: {
      controlMode: "canny",
      controlStrength: 0.8,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
];

export const CUSTOM_PRESET_ID = "custom";

export const DEFAULT_DEFAULTS: PresetDefaults = {
  controlMode: "depth",
  controlStrength: 0.85,
  strength: 0.9,
  guidanceScale: 3.5,
  steps: 30,
};

export function getPreset(id: string | null | undefined): StylePreset | undefined {
  if (!id) return undefined;
  return STYLE_PRESETS.find((p) => p.id === id);
}

export const PRESET_GROUPS = [
  "Ngoại thất",
  "Nội thất",
  "Cảnh quan & đô thị",
  "Kỹ thuật",
] as const;
