/**
 * Sanity checks for the prompt library.
 *
 * Preset defaults have to stay inside the ranges the /api/render zod schema
 * accepts — a preset with steps=60 would only fail at request time, in front of
 * the user. Run with `npm run check:presets`.
 */
import {
  CONTEXT_MODIFIERS,
  LIGHTING_MODIFIERS,
  RESOLUTION_TIERS,
  SUBJECT_GROUPS,
  SUBJECT_PRESETS,
  composePrompt,
  getResolution,
  getSubject,
} from "../src/lib/presets";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  FAIL: ${msg}`);
};

console.log(`Subjects:   ${SUBJECT_PRESETS.length}`);
console.log(`Contexts:   ${CONTEXT_MODIFIERS.length}`);
console.log(`Lightings:  ${LIGHTING_MODIFIERS.length}`);
console.log(
  `Combos:     ${
    SUBJECT_PRESETS.length * CONTEXT_MODIFIERS.length * LIGHTING_MODIFIERS.length
  }`,
);

const ids = SUBJECT_PRESETS.map((s) => s.id);
if (new Set(ids).size !== ids.length) fail("duplicate subject ids");
const ctxIds = CONTEXT_MODIFIERS.map((c) => c.id);
if (new Set(ctxIds).size !== ctxIds.length) fail("duplicate context ids");
const litIds = LIGHTING_MODIFIERS.map((l) => l.id);
if (new Set(litIds).size !== litIds.length) fail("duplicate lighting ids");

for (const s of SUBJECT_PRESETS) {
  if (!SUBJECT_GROUPS.includes(s.group)) fail(`${s.id}: unknown group ${s.group}`);
  if (!s.accuracy.trim()) fail(`${s.id}: empty accuracy clause`);
  if (s.defaults.controlStrength < 0 || s.defaults.controlStrength > 1)
    fail(`${s.id}: controlStrength out of range`);
  if (s.defaults.strength < 0 || s.defaults.strength > 1)
    fail(`${s.id}: strength out of range`);
  // Mirrors the zod bounds in src/app/api/render/route.ts
  if (s.defaults.steps < 4 || s.defaults.steps > 50)
    fail(`${s.id}: steps ${s.defaults.steps} outside API range 4..50`);
  if (s.defaults.guidanceScale < 1 || s.defaults.guidanceScale > 20)
    fail(`${s.id}: guidanceScale outside API range 1..20`);
}

let min = Infinity;
let max = 0;
for (const s of SUBJECT_PRESETS) {
  for (const c of CONTEXT_MODIFIERS) {
    for (const l of LIGHTING_MODIFIERS) {
      const p = composePrompt(s.id, c.id, l.id);
      if (!p) fail(`empty prompt for ${s.id}/${c.id}/${l.id}`);
      if (p.length > 4000)
        fail(`prompt over the 4000-char API cap: ${s.id}/${c.id}/${l.id}`);
      min = Math.min(min, p.length);
      max = Math.max(max, p.length);
    }
  }
}
console.log(`Prompt len: ${min}..${max} chars (API cap 4000)`);

if (composePrompt("nope", "none", "daylight") !== "")
  fail("unknown subject should compose to an empty string, not throw");

for (const t of RESOLUTION_TIERS) {
  if (t.maxSide < 512 || t.maxSide > 2048)
    fail(`${t.id}: maxSide ${t.maxSide} outside API range 512..2048`);
}
if (getResolution("garbage").id !== "standard")
  fail("getResolution should fall back to the standard tier");

// Structures whose geometry is checked in design review must grip harder than
// a road corridor, where a slightly different tree line costs nothing.
const road = getSubject("road-expressway")!;
const cable = getSubject("bridge-cable-stayed")!;
const tunnel = getSubject("tunnel-interior")!;
if (cable.defaults.controlStrength <= road.defaults.controlStrength)
  fail("cable-stayed bridge should grip geometry harder than an expressway");
if (tunnel.defaults.controlStrength <= road.defaults.controlStrength)
  fail("tunnel interior should grip geometry harder than an expressway");
if (getSubject("bridge-from-elevation")!.defaults.controlMode !== "canny")
  fail("the elevation-drawing preset must default to canny");

console.log("\n--- Sample ---");
console.log("Cầu dây văng / Núi đá vôi Đông Bắc / Hoàng hôn vàng:\n");
console.log(composePrompt("bridge-cable-stayed", "karst-northeast", "golden-hour"));

console.log(
  `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`,
);
process.exit(failures === 0 ? 0 : 1);
