import type { ControlMode } from "./providers/types";

/**
 * Prompts are composed from three independent axes instead of one flat list:
 *
 *   Subject (loại công trình)  ×  Context (bối cảnh)  ×  Lighting (ánh sáng)
 *
 * A cable-stayed bridge in Cao Bằng karst at dusk and the same bridge over the
 * Mekong at noon are different renders from the same alignment. Flat presets
 * would need 18 × 8 × 7 = 1008 entries to cover that; three axes need 33.
 */

export interface PresetDefaults {
  controlMode: ControlMode;
  /** 0..1 — how hard the control LoRA pins the source geometry. */
  controlStrength: number;
  /** 0..1 — 0 preserves the source, 1 fully remakes it. */
  strength: number;
  guidanceScale: number;
  steps: number;
}

export type SubjectGroup =
  | "Đường bộ"
  | "Đường sắt"
  | "Cầu"
  | "Hầm"
  | "Kiến trúc";

export interface SubjectPreset {
  id: string;
  name: string;
  /** One-line description shown under the preset name. */
  description: string;
  group: SubjectGroup;
  /** What the structure is, plus camera and framing. No time of day, no landscape. */
  prompt: string;
  /**
   * Positive constraints on the details this structure type gets wrong.
   *
   * FLUX.1 dev ignores negative prompts, so every "don't do X" has to be
   * expressed as a positive "do Y". These clauses are where most of the
   * engineering credibility of a render comes from — a cable-stayed bridge with
   * unequal cable spacing is spotted instantly in a design review.
   */
  accuracy: string;
  defaults: PresetDefaults;
}

export interface ContextModifier {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export interface LightingModifier {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

// ---------------------------------------------------------------------------
// Camera / rendering tails
// ---------------------------------------------------------------------------

/** Infrastructure is shot on longer lenses and from drones, not tilt-shift. */
const INFRA_TAIL =
  "professional infrastructure and civil engineering photography, " +
  "natural perspective with straight undistorted horizon, physically accurate lighting, " +
  "realistic weathering and material aging, sharp focus from foreground to horizon, " +
  "high dynamic range, ultra detailed, 8k";

/** Buildings keep the tilt-shift architectural photography look. */
const ARCH_TAIL =
  "professional architectural photography, shot on full-frame camera, 24mm tilt-shift lens, " +
  "vertical lines perfectly corrected, high dynamic range, physically accurate lighting, " +
  "sharp focus throughout, ultra detailed materials, 8k";

/**
 * Applied to every subject. Garbled lettering on signs and portals is the
 * single most obvious "this is AI" tell in infrastructure renders, and FLUX
 * cannot be talked out of it with a negative prompt — so we ask for clean blank
 * panels instead. Delete this phrase from the prompt box if you want the model
 * to attempt real signage.
 */
const NO_TEXT_CLAUSE =
  "all signage and information panels rendered as clean blank faces without lettering";

/** Kept for history entries and for any future SDXL-class provider. */
const COMMON_NEGATIVE =
  "distorted perspective, warped straight lines, bent verticals, melting geometry, " +
  "unreadable text, watermark, signature, logo, cartoon, illustration, painting, " +
  "cgi render look, plastic materials, oversaturated, blurry, low resolution, jpeg artifacts";

// ---------------------------------------------------------------------------
// Subjects — Đường bộ
// ---------------------------------------------------------------------------

const ROAD_SUBJECTS: SubjectPreset[] = [
  {
    id: "road-expressway",
    name: "Cao tốc — tuyến chính",
    description:
      "Góc nhìn dọc tim tuyến, thấy rõ mặt cắt ngang và dải phân cách. Preset dùng nhiều nhất.",
    group: "Đường bộ",
    prompt:
      "Photorealistic view along a completed modern expressway mainline, camera at driver eye level " +
      "following the alignment toward the vanishing point, full carriageway cross-section visible " +
      "with central median barrier, hard shoulders and drainage, fresh dark asphalt with correct " +
      "surface texture, light free-flowing traffic",
    accuracy:
      "consistent number of traffic lanes throughout the frame, lane width uniform along the whole " +
      "alignment, continuous unbroken edge lines and correctly dashed centre lines with even dash " +
      "spacing, W-beam guardrail with regular equally spaced posts, uniform pavement colour without " +
      "patchwork, smooth continuous vertical and horizontal alignment curvature, " +
      NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.88,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "road-mountain",
    name: "Đường miền núi",
    description:
      "Đường đèo bám sườn núi: mái taluy, tường chắn, rãnh dọc. Hợp tuyến Cao Bằng – Bắc Kạn.",
    group: "Đường bộ",
    prompt:
      "Photorealistic mountain highway cut into a steep hillside, sweeping horizontal curve following " +
      "the terrain, engineered cut slopes with visible benching, shotcrete and gabion retaining walls, " +
      "longitudinal drainage channel along the toe of the slope, guardrail on the valley side, " +
      "elevated viewpoint showing the road threading through the landscape",
    accuracy:
      "cut slope benches at consistent height and batter angle, retaining wall panels of uniform size " +
      "and regular joint pattern, continuous drainage channel with constant cross-section, guardrail " +
      "posts evenly spaced following the curve, lane markings continuous around the curve, " +
      NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "road-interchange",
    name: "Nút giao liên thông",
    description: "Ảnh flycam nút giao nhiều tầng — thấy toàn bộ hình học nhánh rẽ.",
    group: "Đường bộ",
    prompt:
      "Photorealistic aerial drone view of a multi-level grade-separated highway interchange, " +
      "complete geometry of ramps loops and flyovers clearly readable, mainline carriageways passing " +
      "beneath and above, landscaped infield areas between the ramps, surrounding road network " +
      "connecting into the junction",
    accuracy:
      "ramp radii smooth and continuous without kinks, consistent lane count on every ramp, " +
      "structural piers of the flyovers aligned in regular rows, uniform deck thickness on each " +
      "structure, continuous edge lines on all ramps, clean merge and diverge tapers, " +
      NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "road-urban",
    name: "Đường đô thị",
    description: "Tuyến trong phố: vỉa hè, cây xanh, chiếu sáng, giao thông hỗn hợp.",
    group: "Đường bộ",
    prompt:
      "Photorealistic urban arterial street at ground level, finished carriageway with clear lane " +
      "layout, wide paved sidewalks with tactile paving, street trees in regular planting, modern " +
      "street lighting columns, mixed traffic of cars buses and motorbikes, active pedestrian life, " +
      "shopfronts and mid-rise buildings lining both sides",
    accuracy:
      "street lighting columns evenly spaced and identical in height, street trees at regular " +
      "planting intervals, kerb line continuous and parallel to the carriageway, consistent sidewalk " +
      "width, crosswalk stripes evenly spaced and perpendicular to the kerb, " +
      NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.85,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "road-toll-plaza",
    name: "Trạm thu phí",
    description: "Trạm thu phí / trạm dừng nghỉ: mái che lớn, làn phân tách.",
    group: "Đường bộ",
    prompt:
      "Photorealistic highway toll plaza, wide fan of separated toll lanes under a large cantilever " +
      "canopy roof, toll booths and ETC gantries, painted lane channelisation on the approach, " +
      "vehicles queuing and passing through, administration building alongside",
    accuracy:
      "toll lanes of identical width in a symmetric arrangement, canopy structural bays evenly " +
      "spaced with consistent depth, booths identical in size and detailing, channelising island " +
      "noses symmetric, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
];

// ---------------------------------------------------------------------------
// Subjects — Đường sắt
// ---------------------------------------------------------------------------

const RAIL_SUBJECTS: SubjectPreset[] = [
  {
    id: "rail-highspeed-viaduct",
    name: "Đường sắt tốc độ cao — cầu cạn",
    description: "Tuyến ĐSTĐC trên cầu cạn: trụ đều nhịp, dầm hộp liên tục.",
    group: "Đường sắt",
    prompt:
      "Photorealistic high-speed railway on a continuous elevated viaduct, slab track on the deck, " +
      "overhead catenary system with masts along the alignment, sleek concrete box girder spans " +
      "carried on regular piers, sweeping alignment receding into the distance, sound barriers on " +
      "the deck edges",
    accuracy:
      "piers equally spaced with identical span lengths, constant girder depth along the whole " +
      "viaduct, catenary masts at strictly regular intervals and identical height, contact wire " +
      "straight and exactly parallel to the track, two rails at constant gauge perfectly parallel, " +
      "sound barrier panels of uniform size in a continuous run, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.92,
      strength: 0.93,
      guidanceScale: 3.5,
      steps: 34,
    },
  },
  {
    id: "rail-metro-elevated",
    name: "Đường sắt đô thị trên cao",
    description: "Metro trên cao trong phố: trụ chữ T, dầm U/hộp, nhà ga trên cao.",
    group: "Đường sắt",
    prompt:
      "Photorealistic elevated urban metro line running above a city street, U-shaped or box girder " +
      "guideway carried on slender T-shaped piers in the median, modern metro train on the viaduct, " +
      "overhead catenary, city traffic and pedestrians at street level below",
    accuracy:
      "piers evenly spaced in a straight row down the median, identical pier geometry throughout, " +
      "constant guideway depth and width, catenary masts at regular intervals, track gauge constant, " +
      "parapet panels of uniform height in a continuous line, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "rail-ballasted",
    name: "Đường sắt nền đất — ray truyền thống",
    description: "Tuyến trên nền đắp, đá ba lát, tà vẹt bê tông, cột tiếp xúc.",
    group: "Đường sắt",
    prompt:
      "Photorealistic conventional ballasted railway track running along an embankment, crushed stone " +
      "ballast shoulder with clean profile, concrete sleepers and steel rails, catenary masts and " +
      "overhead line, cable troughs and lineside equipment, track receding to the vanishing point",
    accuracy:
      "sleepers evenly spaced at constant pitch, ballast shoulder of constant width and slope, two " +
      "rails perfectly parallel at constant gauge, catenary masts strictly regularly spaced and " +
      "identical, contact wire straight and parallel to the rails, cable trough continuous along the " +
      "track, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "rail-station",
    name: "Ga đường sắt",
    description: "Ke ga, mái che, tàu vào ga — cả ga mặt đất lẫn ga trên cao.",
    group: "Đường sắt",
    prompt:
      "Photorealistic railway station platform, long island platform with tactile edge strip, modern " +
      "lightweight canopy roof over the platform, train berthed at the platform edge, platform " +
      "furniture and lighting, passengers boarding, track and catenary continuing beyond the station",
    accuracy:
      "canopy structural bays evenly spaced with identical columns, platform edge perfectly straight " +
      "and parallel to the track, tactile warning strip continuous at constant offset from the edge, " +
      "platform lighting at regular intervals, train car windows and doors evenly spaced, " +
      NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.9,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
];

// ---------------------------------------------------------------------------
// Subjects — Cầu
// ---------------------------------------------------------------------------

const BRIDGE_SUBJECTS: SubjectPreset[] = [
  {
    id: "bridge-cable-stayed",
    name: "Cầu dây văng",
    description:
      "Dễ sai nhất: AI hay vẽ sai số dây, dây không song song. Preset này ép rất chặt.",
    group: "Cầu",
    prompt:
      "Photorealistic cable-stayed bridge spanning a wide river, tall concrete pylon rising above the " +
      "deck, stay cables in a clean fan arrangement from pylon to deck, slender continuous deck " +
      "carrying the roadway, approach viaducts on both banks, three-quarter view showing the full " +
      "span and the pylon profile",
    accuracy:
      "stay cables straight and taut with strictly equal angular spacing, identical cable count and " +
      "arrangement on both sides of the pylon, cables perfectly symmetric about the pylon axis, no " +
      "crossing or sagging cables, constant deck depth across the main span, deck edge lines straight " +
      "and continuous, pylon perfectly vertical and symmetric, approach piers evenly spaced, " +
      NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.95,
      strength: 0.94,
      guidanceScale: 3.5,
      steps: 36,
    },
  },
  {
    id: "bridge-suspension",
    name: "Cầu treo dây võng",
    description: "Cáp chủ võng đều, dây treo đứng thẳng cách đều.",
    group: "Cầu",
    prompt:
      "Photorealistic suspension bridge, two tall towers carrying main cables in a smooth catenary " +
      "curve, vertical hanger cables dropping to a slender stiffening girder deck, anchorage blocks " +
      "at both ends, wide water crossing below, three-quarter view showing the full main span",
    accuracy:
      "main cable forming one smooth continuous catenary without kinks, hanger cables perfectly " +
      "vertical and evenly spaced along the whole span, hanger lengths varying smoothly with the " +
      "cable curve, both towers identical in height and detailing, deck of constant depth and " +
      "perfectly straight in elevation, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.95,
      strength: 0.94,
      guidanceScale: 3.5,
      steps: 36,
    },
  },
  {
    id: "bridge-box-girder",
    name: "Cầu dầm hộp / extradosed",
    description: "Cầu dầm hộp bê tông đúc hẫng, thay đổi chiều cao dầm theo nhịp.",
    group: "Cầu",
    prompt:
      "Photorealistic prestressed concrete box girder bridge built by balanced cantilever, deep " +
      "haunched girder over the piers tapering smoothly to shallow depth at midspan, tall slender " +
      "piers rising from the water or valley floor, continuous multi-span structure, side elevation " +
      "three-quarter view showing the span rhythm",
    accuracy:
      "span lengths equal and repeating in a regular rhythm, haunch curve identical on every span, " +
      "girder soffit forming a smooth continuous curve without steps, piers identical in shape and " +
      "evenly spaced, deck edge perfectly straight in elevation, clean formwork joint lines at " +
      "regular segment intervals, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.93,
      strength: 0.93,
      guidanceScale: 3.5,
      steps: 34,
    },
  },
  {
    id: "bridge-arch",
    name: "Cầu vòm",
    description: "Cầu vòm thép hoặc bê tông, thanh treo cách đều.",
    group: "Cầu",
    prompt:
      "Photorealistic arch bridge over a river valley, structural arch rib springing from abutments " +
      "on both banks, vertical hangers or spandrel columns transferring the deck load to the arch, " +
      "slender deck running through or over the arch, three-quarter view showing the full arch profile",
    accuracy:
      "arch forming one smooth symmetric curve, hangers or spandrel columns perfectly vertical and " +
      "evenly spaced, arch rib of consistent cross-section, both halves of the arch exactly " +
      "symmetric about midspan, deck straight and of constant depth, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.94,
      strength: 0.93,
      guidanceScale: 3.5,
      steps: 34,
    },
  },
  {
    id: "bridge-viaduct",
    name: "Cầu cạn nhiều nhịp",
    description: "Cầu cạn dầm I/Super-T nhịp đều — dạng phổ biến nhất trên cao tốc.",
    group: "Cầu",
    prompt:
      "Photorealistic multi-span highway viaduct crossing a valley or floodplain, precast concrete " +
      "girder spans of constant depth carried on regular column piers with pier caps, continuous " +
      "parapet along the deck edge, long perspective showing many repeating spans receding into the " +
      "distance",
    accuracy:
      "all spans exactly equal in length, piers identical and evenly spaced in a perfectly straight " +
      "row, constant girder depth on every span, pier caps identical in size, parapet continuous with " +
      "uniform height, deck soffit forming a straight unbroken line, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.92,
      strength: 0.93,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "bridge-urban-flyover",
    name: "Cầu vượt đô thị",
    description: "Cầu vượt nút giao trong phố, có giao thông và bối cảnh nhà cửa.",
    group: "Cầu",
    prompt:
      "Photorealistic urban flyover crossing a busy city intersection, curved elevated deck on slender " +
      "single-column piers, traffic flowing on the flyover and on the streets beneath, landscaped " +
      "areas under the structure, surrounding mid-rise city buildings, street-level viewpoint looking " +
      "up along the structure",
    accuracy:
      "piers evenly spaced along the curve, constant deck depth throughout, parapet continuous at " +
      "uniform height, deck edge forming a smooth curve without kinks, consistent lane count on the " +
      "flyover, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
  {
    id: "bridge-from-elevation",
    name: "Cầu — từ bản vẽ mặt đứng",
    description:
      "Dùng khi nguồn là bản vẽ CAD 2D mặt đứng, không phải model 3D. Tự đặt Canny.",
    group: "Cầu",
    prompt:
      "Photorealistic bridge rendered strictly from the underlying elevation drawing, every drawn " +
      "structural line respected exactly, realistic concrete steel and cable materials applied to the " +
      "drawn geometry, water and banks below, natural environment behind, straight-on elevation " +
      "viewpoint matching the drawing",
    accuracy:
      "span lengths and member depths exactly as drawn, pier positions exactly as drawn, cable or " +
      "hanger count exactly as drawn with even spacing, structure perfectly symmetric where the " +
      "drawing is symmetric, deck line straight and horizontal, no drawn line left unbuilt and no " +
      "structural element invented, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "canny",
      controlStrength: 0.97,
      strength: 0.95,
      guidanceScale: 3.5,
      steps: 36,
    },
  },
];

// ---------------------------------------------------------------------------
// Subjects — Hầm
// ---------------------------------------------------------------------------

const TUNNEL_SUBJECTS: SubjectPreset[] = [
  {
    id: "tunnel-portal",
    name: "Cửa hầm",
    description: "Cửa hầm và tường cánh, mái taluy phía trên, đường dẫn vào hầm.",
    group: "Hầm",
    prompt:
      "Photorealistic highway tunnel portal cut into a mountainside, architectural portal headwall " +
      "framing the bore opening, wing walls retaining the slope on both sides, rock face and " +
      "vegetation above the portal, approach road with lane markings leading into the dark opening, " +
      "portal lighting and ventilation louvres",
    accuracy:
      "portal opening perfectly symmetric about its centreline, wing walls symmetric on both sides, " +
      "headwall panel joints in a regular grid, approach road lane markings continuous into the " +
      "portal, slope protection mesh or shotcrete of uniform texture, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.92,
      strength: 0.93,
      guidanceScale: 3.5,
      steps: 34,
    },
  },
  {
    id: "tunnel-interior",
    name: "Trong hầm",
    description:
      "Lòng hầm nhìn dọc: quan trọng nhất là nhịp đèn và mặt cắt giữ đều tới điểm tụ.",
    group: "Hầm",
    prompt:
      "Photorealistic interior of a modern road tunnel looking along the bore toward the distant " +
      "exit, curved tunnel lining with smooth finish, continuous rows of ceiling luminaires receding " +
      "to the vanishing point, jet fans mounted at the crown, carriageway with lane markings and " +
      "raised kerb, emergency walkway along the sidewall, warm artificial lighting on the lining",
    accuracy:
      "tunnel cross-section constant along the entire bore, ceiling luminaires evenly spaced in a " +
      "perfectly straight line converging on the vanishing point, jet fans at regular intervals and " +
      "identical, lining panel joints in a regular repeating pattern, lane markings continuous and " +
      "straight, walkway kerb continuous at constant height, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.94,
      strength: 0.93,
      guidanceScale: 3.5,
      steps: 34,
    },
  },
  {
    id: "tunnel-underpass",
    name: "Hầm chui đô thị",
    description: "Hầm chui hở trong phố: tường chắn dốc dần, đường dẫn hai đầu.",
    group: "Hầm",
    prompt:
      "Photorealistic urban road underpass, open cut approach ramp descending between retaining walls " +
      "into a covered box section, clean concrete wall finish, lane markings and edge lines on the " +
      "ramp, street level traffic and city context above the structure, handrails along the wall tops",
    accuracy:
      "retaining walls descending at a constant smooth gradient, wall panel joints evenly spaced, " +
      "handrail continuous at constant height above the wall, lane markings continuous down the ramp, " +
      "box section opening symmetric about the road centreline, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.92,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 32,
    },
  },
];

// ---------------------------------------------------------------------------
// Subjects — Kiến trúc (giữ lại từ bản đầu)
// ---------------------------------------------------------------------------

const ARCH_SUBJECTS: SubjectPreset[] = [
  {
    id: "arch-exterior",
    name: "Ngoại thất công trình",
    description: "Nhà điều hành, trạm dừng nghỉ, nhà ga — phối cảnh ngoài.",
    group: "Kiến trúc",
    prompt:
      "Photorealistic exterior view of a modern building, full massing clearly readable, concrete " +
      "glass and timber facade materials with realistic reflections, entrance plaza and landscaping, " +
      "a few people for scale",
    accuracy:
      "consistent floor heights, window openings aligned in a regular grid, facade panel joints " +
      "uniform, roof line straight, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.85,
      strength: 0.9,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "arch-interior",
    name: "Nội thất công trình",
    description: "Nội thất nhà ga, sảnh điều hành, phòng làm việc.",
    group: "Kiến trúc",
    prompt:
      "Photorealistic modern interior space, abundant natural daylight from large glazing, soft " +
      "indirect bounce light, realistic floor and wall material textures, layered artificial lighting, " +
      "furniture and fittings at correct human scale, clean uncluttered composition",
    accuracy:
      "ceiling grid regular and aligned, lighting fixtures evenly spaced, floor joint pattern " +
      "consistent, wall and ceiling planes meeting cleanly, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.9,
      strength: 0.88,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "arch-masterplan",
    name: "Phối cảnh tổng thể",
    description: "Flycam tổng mặt bằng dự án, thấy toàn bộ phạm vi công trình.",
    group: "Kiến trúc",
    prompt:
      "Photorealistic aerial drone view of a project masterplan, clear overview of building massing " +
      "roads and open space, mature landscaping and tree canopies, realistic paving and roof " +
      "materials, distant landscape and atmospheric perspective",
    accuracy:
      "building footprints matching the plan, road alignments smooth and continuous, planting in " +
      "coherent arrangements, " + NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "depth",
      controlStrength: 0.85,
      strength: 0.9,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
  {
    id: "arch-construction",
    name: "Ảnh thi công thực tế",
    description: "Mô phỏng giai đoạn thi công: giàn giáo, cẩu, vật liệu tại chỗ.",
    group: "Kiến trúc",
    prompt:
      "Photorealistic construction site photograph of the works under construction, exposed structural " +
      "frame, scaffolding and safety netting, tower crane, stacked materials and site fencing, workers " +
      "in high-visibility PPE, authentic dust and site texture, documentary photojournalism style",
    accuracy:
      "scaffolding standards evenly spaced, formwork panels of uniform size, site fencing continuous, " +
      NO_TEXT_CLAUSE,
    defaults: {
      controlMode: "canny",
      controlStrength: 0.82,
      strength: 0.92,
      guidanceScale: 3.5,
      steps: 30,
    },
  },
];

export const SUBJECT_PRESETS: SubjectPreset[] = [
  ...ROAD_SUBJECTS,
  ...RAIL_SUBJECTS,
  ...BRIDGE_SUBJECTS,
  ...TUNNEL_SUBJECTS,
  ...ARCH_SUBJECTS,
];

export const SUBJECT_GROUPS: SubjectGroup[] = [
  "Đường bộ",
  "Đường sắt",
  "Cầu",
  "Hầm",
  "Kiến trúc",
];

// ---------------------------------------------------------------------------
// Context — bối cảnh Việt Nam
// ---------------------------------------------------------------------------

/**
 * Generic prompts produce North-American or European landscapes: pine forest,
 * temperate deciduous trees, wide dry shoulders. These put the structure in the
 * terrain it will actually be built in.
 */
export const CONTEXT_MODIFIERS: ContextModifier[] = [
  {
    id: "none",
    name: "Không chỉ định",
    description: "Để AI tự chọn bối cảnh theo ảnh nguồn.",
    prompt: "",
  },
  {
    id: "karst-northeast",
    name: "Núi đá vôi Đông Bắc",
    description: "Cao Bằng, Bắc Kạn, Lạng Sơn, Hà Giang — núi đá vôi dựng đứng.",
    prompt:
      "set in the karst limestone landscape of northeastern Vietnam, dramatic steep-sided limestone " +
      "peaks with near-vertical grey rock faces and dense green vegetation clinging to them, narrow " +
      "valleys between the massifs, tropical subtropical foliage, layers of hazy blue mountains " +
      "receding into the distance",
  },
  {
    id: "mountain-northwest",
    name: "Núi rừng Tây Bắc",
    description: "Sơn La, Lai Châu, Yên Bái — núi đất, rừng, ruộng bậc thang.",
    prompt:
      "set in the forested mountains of northwestern Vietnam, rounded earth mountains covered in dense " +
      "tropical forest, terraced rice paddies stepping down the hillsides, scattered stilt houses of " +
      "ethnic minority villages, deep valleys with mist gathering in the folds",
  },
  {
    id: "delta-red-river",
    name: "Đồng bằng Bắc Bộ",
    description: "Đồng bằng sông Hồng — ruộng lúa, làng mạc, tre.",
    prompt:
      "set in the Red River delta of northern Vietnam, flat open landscape of green rice paddies " +
      "divided by earth bunds, dense bamboo groves screening traditional villages, irrigation canals " +
      "and small ponds, water buffalo and farmers working the fields, wide low horizon",
  },
  {
    id: "delta-mekong",
    name: "Đồng bằng sông Cửu Long",
    description: "Miền Tây — kênh rạch, dừa nước, nhà ven sông.",
    prompt:
      "set in the Mekong delta of southern Vietnam, flat waterlogged landscape threaded with wide " +
      "brown rivers and narrow canals, nipa palm and coconut palm along the banks, stilt houses and " +
      "small boats on the water, lush tropical green everywhere, enormous open sky",
  },
  {
    id: "coastal-central",
    name: "Ven biển miền Trung",
    description: "Đà Nẵng, Quảng Bình, Nha Trang — biển, cồn cát, phi lao.",
    prompt:
      "set on the central coast of Vietnam, turquoise sea and long sandy beach, casuarina windbreak " +
      "trees along the shore, low sand dunes, coastal mountains dropping toward the water in the " +
      "distance, bright tropical maritime light and salt haze",
  },
  {
    id: "urban-central-danang",
    name: "Đô thị miền Trung (Đà Nẵng)",
    description:
      "Đà Nẵng, Huế, Quy Nhơn — đô thị ven biển quy hoạch bài bản: đường rộng, dải phân cách trồng cây, núi xanh làm nền.",
    prompt:
      "set in Da Nang, a modern planned coastal city in central Vietnam, unusually wide and orderly " +
      "boulevards with broad landscaped central medians, coconut palms and flame trees lining the " +
      "roadside, clean wide paved sidewalks with granite kerbs, mid-rise contemporary buildings and " +
      "white resort towers rather than dense narrow tube houses, the Han River and its landmark " +
      "bridges in the middle distance, the forested Son Tra peninsula headland and the blue Truong " +
      "Son mountains rising behind the city, bright humid coastal light with sea haze softening the " +
      "far distance, traffic noticeably lighter and more orderly than Hanoi or Ho Chi Minh City",
  },
  {
    id: "midland-hills",
    name: "Trung du",
    description: "Phú Thọ, Thái Nguyên, Bắc Giang — đồi thấp, chè, keo.",
    prompt:
      "set in the Vietnamese midland hill country, gently rolling low hills covered in tea plantations " +
      "and acacia plantation forest, red lateritic soil exposed on cut slopes, scattered rural " +
      "settlements, soft undulating horizon",
  },
  {
    id: "urban-vietnam",
    name: "Đô thị Việt Nam",
    description: "Hà Nội, TP.HCM — nhà ống, dây điện, giao thông xe máy.",
    prompt:
      "set in a dense Vietnamese city, narrow tube houses with mixed facades and rooftop water tanks, " +
      "shophouses at street level with awnings, mature street trees, heavy motorbike traffic mixed " +
      "with cars, busy tropical urban atmosphere",
  },
];

// ---------------------------------------------------------------------------
// Lighting — ánh sáng & thời tiết
// ---------------------------------------------------------------------------

export const LIGHTING_MODIFIERS: LightingModifier[] = [
  {
    id: "daylight",
    name: "Nắng trong ban ngày",
    description: "Nắng giữa trưa, bóng đổ rõ. An toàn nhất, hợp hồ sơ kỹ thuật.",
    prompt:
      "clear midday daylight, deep blue sky with scattered cumulus clouds, crisp directional sunlight " +
      "casting well-defined shadows, excellent visibility to the horizon",
  },
  {
    id: "overcast",
    name: "Trời nhiều mây",
    description: "Ánh sáng tán xạ, không bóng gắt — thấy rõ hình khối nhất.",
    prompt:
      "soft overcast daylight, uniform bright grey cloud cover acting as a giant softbox, shadowless " +
      "even illumination revealing every surface and form clearly, neutral colour balance",
  },
  {
    id: "golden-hour",
    name: "Hoàng hôn vàng",
    description: "Nắng xiên vàng ấm, bóng dài. Ảnh đẹp nhất cho bìa hồ sơ.",
    prompt:
      "golden hour light, low warm sun raking across the structure, long soft shadows stretching " +
      "across the scene, warm orange and amber sky gradient, atmospheric haze catching the light",
  },
  {
    id: "blue-hour",
    name: "Chạng vạng xanh",
    description: "Blue hour: đèn công trình là nguồn sáng chính, trời xanh thẫm.",
    prompt:
      "blue hour dusk, deep indigo sky, artificial lighting of the structure as the dominant light " +
      "source, warm lamp glow against the cool sky, balanced exposure between sky and lit surfaces",
  },
  {
    id: "night",
    name: "Ban đêm",
    description: "Đêm hẳn: đèn đường, vệt đèn xe, thấy rõ hệ thống chiếu sáng.",
    prompt:
      "night scene, dark sky, roadway and structural lighting fully on and clearly readable, warm " +
      "pools of light on the pavement, long light trails from moving vehicles, controlled contrast " +
      "with detail retained in the shadows",
  },
  {
    id: "morning-mist",
    name: "Sương sớm",
    description: "Sương núi buổi sáng — rất hợp tuyến miền núi phía Bắc.",
    prompt:
      "early morning with mist lying in the valleys, soft low sun breaking through the haze, layered " +
      "atmospheric depth with distant hills fading into white, dew on surfaces, cool tranquil " +
      "tropical highland atmosphere",
  },
  {
    id: "after-rain",
    name: "Sau mưa",
    description: "Mặt đường ướt phản chiếu — làm mặt đường và vạch kẻ nổi bật.",
    prompt:
      "just after tropical rain, wet reflective pavement mirroring the sky and lights, standing water " +
      "in the gutters, dramatic broken clouds clearing with shafts of sunlight, saturated deep greens " +
      "on the vegetation, fresh washed atmosphere",
  },
];

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export const CUSTOM_PRESET_ID = "custom";
export const DEFAULT_SUBJECT_ID = "road-expressway";
export const DEFAULT_CONTEXT_ID = "karst-northeast";
export const DEFAULT_LIGHTING_ID = "daylight";

export function getSubject(id: string | null | undefined) {
  if (!id) return undefined;
  return SUBJECT_PRESETS.find((p) => p.id === id);
}

export function getContext(id: string | null | undefined) {
  if (!id) return undefined;
  return CONTEXT_MODIFIERS.find((c) => c.id === id);
}

export function getLighting(id: string | null | undefined) {
  if (!id) return undefined;
  return LIGHTING_MODIFIERS.find((l) => l.id === id);
}

export type PromptStyle = "describe" | "instruct";

/** Groups whose subjects carry a road carriageway, so a lane count applies. */
const CARRIAGEWAY_GROUPS: SubjectGroup[] = ["Đường bộ", "Cầu", "Hầm"];

export function subjectHasLanes(subjectId: string): boolean {
  const subject = getSubject(subjectId);
  return subject ? CARRIAGEWAY_GROUPS.includes(subject.group) : false;
}

export const MAX_LANES_PER_DIRECTION = 6;

/**
 * Lane count is the single detail reviewers check first, and diffusion models
 * are poor at counting. Naming the number several ways in one clause — per
 * direction, as a total, and as a "must not change" constraint — measurably
 * beats a single mention, so this is deliberately repetitive rather than terse.
 */
function lanesClause(lanes: number): string {
  const total = lanes * 2;
  return (
    `exactly ${lanes} traffic ${lanes === 1 ? "lane" : "lanes"} in each direction, ` +
    `${total} lanes in total across the full carriageway, ` +
    `${lanes} on the near side and ${lanes} on the far side of the central median, ` +
    `the same ${lanes} lanes per direction held continuously from the foreground ` +
    `to the vanishing point, the lane count never changing anywhere in the frame`
  );
}

/**
 * Order matters. FLUX weights earlier tokens more heavily, so the structure and
 * its accuracy constraints come first, then where it sits, then how it is lit,
 * then the camera.
 */
function composeDescribePrompt(
  subject: SubjectPreset,
  contextId: string,
  lightingId: string,
  extra?: string,
  lanes?: number | null,
): string {
  const tail = subject.group === "Kiến trúc" ? ARCH_TAIL : INFRA_TAIL;

  return [
    subject.prompt,
    // Right after the subject, ahead of the other accuracy constraints: FLUX
    // weights earlier tokens more heavily and this is the one a reviewer counts.
    lanes ? lanesClause(lanes) : undefined,
    subject.accuracy,
    getContext(contextId)?.prompt,
    getLighting(lightingId)?.prompt,
    // Project specifics sit just before the camera tail: late enough not to
    // dilute the geometry constraints, early enough to still carry weight.
    extra,
    tail,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

/**
 * Edit models (Nano Banana, FLUX Kontext) receive the source image itself
 * rather than a control map, and respond to instructions, not scene
 * descriptions. Same domain knowledge, different grammar — and a hard
 * preservation clause up front, since these models have no adherence dial.
 */
function composeInstructPrompt(
  subject: SubjectPreset,
  contextId: string,
  lightingId: string,
  extra?: string,
  lanes?: number | null,
): string {
  const tail = subject.group === "Kiến trúc" ? ARCH_TAIL : INFRA_TAIL;
  const context = getContext(contextId)?.prompt;
  const lighting = getLighting(lightingId)?.prompt;

  const lines = [
    "Turn this engineering source image into a photorealistic photograph.",
    "",
    "Keep the existing geometry, proportions, camera angle and composition exactly as they are. Do not add, remove, relocate or reshape any structural element, and do not change the number of any repeated element.",
    "",
    `Subject: ${subject.prompt}.`,
  ];

  // Its own line, above the general constraints: an edit model follows a
  // numbered requirement far better when it is not buried in a long clause.
  if (lanes) lines.push(`Lane count — this is mandatory: ${lanesClause(lanes)}.`);

  lines.push(`Preserve precisely: ${subject.accuracy}.`);

  if (context) lines.push(`Environment: ${context}.`);
  if (lighting) lines.push(`Lighting: ${lighting}.`);
  if (extra?.trim()) lines.push(`Project specifics: ${extra.trim()}.`);
  lines.push(`Look: ${tail}.`);

  return lines.join("\n");
}

export function composePrompt(
  subjectId: string,
  contextId: string,
  lightingId: string,
  style: PromptStyle = "describe",
  /**
   * Free text the user supplies for this project — lane counts, materials,
   * paint colours. Kept as its own field rather than typed into the composed
   * prompt so that changing an axis re-composes without discarding it.
   */
  extra?: string,
  /** Lanes per direction; null/0 leaves the count unconstrained. */
  lanes?: number | null,
): string {
  const subject = getSubject(subjectId);
  if (!subject) return "";

  // A lane count on a railway station or a building is meaningless, and asking
  // for one would only confuse the model.
  const effectiveLanes = subjectHasLanes(subjectId) ? lanes : null;

  return style === "instruct"
    ? composeInstructPrompt(subject, contextId, lightingId, extra, effectiveLanes)
    : composeDescribePrompt(subject, contextId, lightingId, extra, effectiveLanes);
}

export function defaultNegativePrompt(): string {
  return COMMON_NEGATIVE;
}

export const DEFAULT_DEFAULTS: PresetDefaults = {
  controlMode: "depth",
  controlStrength: 0.9,
  strength: 0.92,
  guidanceScale: 3.5,
  steps: 32,
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolutionTier {
  id: string;
  name: string;
  description: string;
  /** Longest side in pixels. */
  maxSide: number;
}

export const RESOLUTION_TIERS: ResolutionTier[] = [
  {
    id: "fast",
    name: "Nhanh",
    description: "Cạnh dài 1024px. Dùng để thử prompt và chọn góc — rẻ nhất.",
    maxSide: 1024,
  },
  {
    id: "standard",
    name: "Chuẩn",
    description: "Cạnh dài 1440px. Đủ cho trình chiếu và báo cáo.",
    maxSide: 1440,
  },
  {
    id: "high",
    name: "Cao",
    description: "Cạnh dài 2048px. Cho bản in A3 và bìa hồ sơ. Tốn gấp ~2x.",
    maxSide: 2048,
  },
];

export const DEFAULT_RESOLUTION_ID = "standard";

export function getResolution(id: string | null | undefined): ResolutionTier {
  return (
    RESOLUTION_TIERS.find((r) => r.id === id) ??
    RESOLUTION_TIERS.find((r) => r.id === DEFAULT_RESOLUTION_ID)!
  );
}
