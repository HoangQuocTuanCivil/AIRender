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
  resolvedLens,
  subjectHasLanes,
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

// Both grammars are exercised: "describe" drives FLUX ControlNet, "instruct"
// drives edit models like Nano Banana.
for (const style of ["describe", "instruct"] as const) {
  let min = Infinity;
  let max = 0;
  for (const s of SUBJECT_PRESETS) {
    for (const c of CONTEXT_MODIFIERS) {
      for (const l of LIGHTING_MODIFIERS) {
        const p = composePrompt(s.id, c.id, l.id, style);
        if (!p) fail(`empty ${style} prompt for ${s.id}/${c.id}/${l.id}`);
        if (p.length > 4000)
          fail(`${style} prompt over the 4000-char API cap: ${s.id}/${c.id}/${l.id}`);
        min = Math.min(min, p.length);
        max = Math.max(max, p.length);
      }
    }
  }
  console.log(`Prompt len (${style}): ${min}..${max} chars (API cap 4000)`);
}

// The edit grammar must lead with the preservation clause — it is the only
// structural control an edit model has.
const instruct = composePrompt(
  "bridge-cable-stayed",
  "karst-northeast",
  "golden-hour",
  "instruct",
);
if (!/^Turn this engineering source image/.test(instruct))
  fail("instruct prompt must open with the conversion instruction");
if (!instruct.includes("Do not add, remove, relocate or reshape"))
  fail("instruct prompt must carry the hard preservation clause");

// Project specifics must survive into both grammars, and must survive a change
// of any axis — that is the whole reason the field exists.
const EXTRA = "exactly 4 lanes in each direction";
for (const style of ["describe", "instruct"] as const) {
  for (const ctx of ["none", "karst-northeast", "delta-mekong"]) {
    for (const lit of ["daylight", "night"]) {
      const p = composePrompt("road-expressway", ctx, lit, style, EXTRA);
      if (!p.includes(EXTRA))
        fail(`${style}/${ctx}/${lit}: project specifics dropped from prompt`);
    }
  }
  // Blank extras must not leave dangling separators or an empty labelled line.
  const blank = composePrompt("road-expressway", "none", "daylight", style, "  ");
  if (/,\s*,/.test(blank) || /Project specifics:\s*\./.test(blank))
    fail(`${style}: blank project specifics left a dangling fragment`);
}

// Lane count must reach both grammars, and must be stated more than once —
// a single mention is what diffusion models miscount.
for (const style of ["describe", "instruct"] as const) {
  const p = composePrompt("road-expressway", "none", "daylight", style, "", 3);
  const mentions = (p.match(/\b3\b/g) ?? []).length;
  if (mentions < 2)
    fail(`${style}: lane count stated only ${mentions}× — needs repetition`);
  if (!p.includes("6 lanes in total"))
    fail(`${style}: lane clause is missing the total across the carriageway`);
}

// A lane count is meaningless on subjects with no carriageway, and asking for
// one would only confuse the model.
for (const id of ["rail-station", "arch-interior"]) {
  if (subjectHasLanes(id)) fail(`${id} should not accept a lane count`);
  const p = composePrompt(id, "none", "daylight", "describe", "", 4);
  if (/\b8 lanes in total\b/.test(p))
    fail(`${id}: lane clause leaked into a subject with no carriageway`);
}
for (const id of ["road-expressway", "bridge-viaduct", "tunnel-interior"]) {
  if (!subjectHasLanes(id)) fail(`${id} carries a carriageway and should accept lanes`);
}

// Omitting the count must leave no trace of the clause.
if (/lanes in total/.test(composePrompt("road-expressway", "none", "daylight")))
  fail("lane clause appears even when no count was given");

// Every subject must name the lens a professional would mount, so a user who
// never opens the quality panel still gets a considered frame.
for (const s2 of SUBJECT_PRESETS) {
  const lens = resolvedLens(s2.id, "auto");
  if (lens.id === "auto" || !lens.prompt)
    fail(`${s2.id}: auto lens resolved to nothing`);
}
if (resolvedLens("bridge-viaduct", "auto").id !== "tele")
  fail("a multi-span viaduct should default to the compressing telephoto");
if (resolvedLens("tunnel-interior", "auto").id !== "wide-ts")
  fail("a tunnel bore is confined and should default to the wide lens");
// An explicit choice must beat the per-subject default.
if (resolvedLens("bridge-viaduct", "standard").id !== "standard")
  fail("an explicitly chosen lens must override the subject default");

// The tails must not name a lens any more, or a chosen telephoto contradicts them.
for (const style of ["describe", "instruct"] as const) {
  const p2 = composePrompt("arch-exterior", "none", "daylight", style, "", null, {
    lensId: "tele",
    trafficId: "auto",
    seasonId: "auto",
    gradingId: "auto",
  });
  if (/24mm/.test(p2))
    fail(`${style}: a telephoto prompt still contains the hardcoded 24mm tail`);
  if (!/135mm/.test(p2)) fail(`${style}: the chosen telephoto is missing`);
}

// Axes left on auto must leave no trace.
const bare = composePrompt("road-expressway", "none", "daylight");
if (/Traffic:|Season:|Grading:/.test(bare))
  fail("an auto quality axis leaked a labelled line into the prompt");

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
