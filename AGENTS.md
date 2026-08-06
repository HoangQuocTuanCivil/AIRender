<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# A2ZRender

AI rendering for **linear infrastructure** — roads, railways, bridges, tunnels. Source image (3D model screenshot / sketch / CAD elevation) → photoreal render with the geometry preserved via ControlNet.

Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma 7 + SQLite · fal.ai / Replicate.

## Commands

```bash
npm run dev            # dev server on :3000
npm run build          # prisma generate && next build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run check:presets  # prompt-library sanity checks
npm run db:push        # sync schema.prisma → SQLite
```

Always run `npm run typecheck && npm run lint` before declaring work done, plus `npm run check:presets` after touching `presets.ts`. All three are clean as of the last commit — keep them that way.

## Version-specific gotchas

These bit during the initial build; they are not in most training data.

**Prisma 7** — the connection URL is no longer in `schema.prisma`. It lives in `prisma.config.ts`, and Prisma 7 does *not* auto-load `.env`, so that file calls `process.loadEnvFile()` itself. The runtime client needs an explicit driver adapter (`PrismaBetterSqlite3` — note the lowercase `qlite`, not `SQLite`). Generated client goes to `src/generated/prisma`, is gitignored, and is excluded from ESLint.

**Next 16 / React 19 lint** — `react-hooks/set-state-in-effect` is an *error*, not a warning. Do not call `setState` synchronously in an effect body. Reset child state with a `key` prop instead (see `<RenderResult key={render?.id}>` in `studio-client.tsx`), or set the state from the event handler that caused the change.

**Filesystem tracing** — a top-level `path.resolve(process.cwd(), …)` makes Next trace the whole project into the server bundle. `storage.ts` resolves its root lazily behind `storageRoot()` and marks the `fs` calls with `/* turbopackIgnore: true */`.

**Fonts** — Geist has no `vietnamese` subset. The UI is Vietnamese, so the sans font is Inter. Do not swap it back.

**Seeds are text, not integers.** fal returns seeds far past `Number.MAX_SAFE_INTEGER` (observed 16230947957082601000). Stored as `Int`, reading the row back throws `P2023` before Prisma even sees it — and `node:sqlite` throws too, so the row becomes unreadable by any route. The column is `String?`; `isReusableSeed` in `utils.ts` gates whether one can be fed back in, since anything past the safe range came back approximate and would render something other than what it labels.

**Client/server boundary.** `jobs.ts` and `settings.ts` import Prisma, so client components may only `import type` from them (or from a route module that imports them, as `settings-client.tsx` does). Importing a *value* (even a pure helper) drags `better-sqlite3` into the browser bundle and the build fails with `Can't resolve 'fs'`. Shared runtime helpers belong in `utils.ts`.

**Custom properties resolve where they are declared.** `--module-soft` is derived from `--module` on `.vx-shell` itself, not on `:root`, because a `var()` inside a custom property is substituted against the element carrying the declaration. Setting `--module-soft` inline alongside `--module` is what broke dark mode once — the inline light tint outranked the dark override and produced white-on-white.

## Architecture rules

**Provider abstraction is load-bearing.** API routes and UI never import `@fal-ai/client` or `replicate` directly — everything goes through `RenderProvider` in `src/lib/providers/types.ts`. To add a backend, implement the interface and append to `PROVIDERS` in `providers/index.ts`; nothing else changes.

A provider is really an *engine*, and engines differ in kind, not just vendor:

- `supportsControlNet: false` (Nano Banana) means there is no control map and no adherence dial. The UI hides the ControlNet panel and the diffusion knobs entirely rather than disabling them — showing a slider that silently does nothing is worse than showing none.
- `promptStyle` decides prompt grammar. `"describe"` composes a scene description for models steered by a control map; `"instruct"` composes an edit instruction, leading with the hard preservation clause, for models that receive the source image directly. Changing engine recomposes the prompt in the new grammar.

Both fal-hosted engines share `FAL_KEY`; credential and upload handling lives in `providers/fal-shared.ts` so they cannot drift apart.

**Model endpoint slugs are env-overridable.** fal rotates them. Defaults live in each adapter's `MODELS` map, overridable via `FAL_MODEL_*` / `REPLICATE_MODEL_*`.

**Credentials come from `secret()`, not `process.env`.** Keys are editable in the Cài đặt screen and stored in the `Setting` table, so a provider that reads `process.env.FAL_KEY` directly would ignore whatever the user just typed. `secret(name)` in `settings.ts` returns the stored value, falling back to the environment variable of the same name — stored wins, and the screen labels which source is live.

It reads a synchronous in-memory cache because `isConfigured()` is synchronous, so **any route that resolves a provider must `await loadSettings()` first**. `startRender` does it for the whole render path, `/api/providers` and `/api/settings` for theirs. Model slugs stay on `process.env`: they are a deployment detail, not something the UI edits.

**Rendering is a background job, not a long request.** `POST /api/render` writes the DB row, spawns the job, returns `202 {id}`. The client polls `GET /api/render/[id]`. Live progress sits in a `globalThis` `Map` (`src/lib/jobs.ts`); durable state is SQLite. Don't convert this back to a synchronous request — renders take 20–90s.

**The rail icon is server-rendered from a setting.** The root layout reads it and passes it to `AppShell`, and calls `connection()` first — without that, the synchronous SQLite read completes during prerendering and every visitor gets whatever icon existed at build time. The Cài đặt screen calls `router.refresh()` after an upload for the same reason: the rail is not its own state.

**Images never go in `public/`.** They live under `storage/` and are served by `/api/files/[...path]`, which rejects any path escaping the storage root. Keep that guard.

**Config errors are 400, not 500.** A missing API key is the caller's problem. `resolveProvider` throws `ProviderError` specifically so the routes answer 400 with an actionable Vietnamese message.

## Region editing

**The "everything outside the region is untouched" guarantee comes from `imaging.ts`, not from any model.** `compositeThroughMask` copies pixels outside the mask straight from the parent image; they never pass through an engine. This is not belt-and-braces — the engine that works best here (Nano Banana) accepts no mask at all, and even FLUX Fill returns a freshly encoded frame whose "untouched" areas differ. `npm run check:imaging` asserts zero changed pixels outside the mask, and a live edit measured 0.027% — entirely the 4px feather at the boundary.

The region is **cropped with padding and sent alone**, not sent as a full frame with instructions to change one corner. That gives the model the region at full resolution and gives it surrounding context to match lighting against. `padBox` has a pixel minimum as well as a fraction, because a small scribble grown by a percentage is still too small to render.

`maskBounds` reads the mask server-side rather than trusting a box from the browser: a client could otherwise claim a small box while painting a large area, and the crop and the composite would disagree.

**Nano Banana follows Vietnamese directly** — verified live, including "keep the rest unchanged". `understandsVietnamese` gates the translation step so it only runs for the FLUX family. Do not add a blanket translate-everything step.

`supportsMask` is false for every engine except FLUX Fill, which is `editOnly` and therefore hidden from the studio's engine picker — it cannot render a full frame.

**Mask polarity is measured, not assumed: white is repainted.** fal documents neither endpoint's convention, so it was tested — a white ellipse over the sky changed 92.5% of pixels inside it and 25% outside. That 25% is the important half of the result: a model given an explicit mask still rewrote a quarter of the area it was told to preserve, which is why the composite is not optional.

**The two engines behave differently inside the region.** FLUX Fill fills the mask *shape* — an elliptical mask produces an ellipse of content, so the mask has to follow the real edges of what is being changed. Nano Banana sees a cropped photograph with context and composes within it, so a rough mask still gives a natural result. Prefer Nano Banana for anything organic; FLUX Fill when the boundary itself is the point.

## Prompt library

`presets.ts` composes prompts from three independent axes — Subject × Context × Lighting (23 × 10 × 7). Never flatten this back into a single preset list; the whole point is that a bridge in Cao Bằng karst and the same bridge over the Mekong are different renders from one model.

Every subject carries an `accuracy` clause naming the details that structure type gets wrong (cable spacing, span equality, catenary mast pitch, lane-count continuity). These are **positive** constraints because FLUX.1 dev ignores negative prompts — never move a constraint into `negativePrompt` and consider it handled.

Subject defaults encode how tightly each structure must grip its geometry: bridges and tunnels 0.92–0.97, railways 0.90, roads 0.85–0.90. Keep that ordering — `check:presets` asserts it.

`lanesPerDirection` is a structured field, not prose in `extraDetails`, because the composer can then repeat the number several ways in one clause — per direction, as a total, and as a "never changes" constraint — and place it first, where FLUX weights it most. Diffusion models miscount when a number is mentioned once; `check:presets` asserts the clause states it at least twice. It only applies to subjects in `CARRIAGEWAY_GROUPS`; `composePrompt` drops it for stations and buildings rather than trusting the caller.

`extraDetails` is the user's project-specific free text and is kept as its own field, never merged into `prompt` state. Changing an axis re-composes the whole prompt, so anything typed directly into the prompt box is discarded — `extraDetails` is the field that survives that, and `check:presets` asserts it appears in both grammars across axis changes. Do not "simplify" it away by folding it into the prompt string.

## Styling

The visual language is ported from `vcc-platform` (which is Vite + Ant Design; only the design language travels, not the framework). Its two hard rules apply here:

1. **Light and dark ship together.** Dark flips the neutral ramp under the same variable names, so components never carry per-theme classes. Any new hard-coded colour needs a `[data-vx-dark="1"]` counterpart. Verify both modes before calling a UI change done.
2. **Module colour only at accent points** — rail icon, its 3px indicator, selected state. Page background stays neutral; module colour is never a status colour.

Component idiom: buttons flat with no shadow at 7px radius / weight 600, secondary outlined not filled; panels get a 1px hairline, 8px radius and exactly one shadow layer; chips are borderless with a leading dot at 6px.

## UI language

All user-facing strings are **Vietnamese**. Code, comments, identifiers, and commit messages are **English**. Model prompts in `presets.ts` are English on purpose — FLUX performs markedly worse on Vietnamese prompts.

## Where things are

| Need to change… | File |
|---|---|
| Subjects / contexts / lighting / prompts | `src/lib/presets.ts` |
| A provider's request shape | `src/lib/providers/{fal,replicate}.ts` |
| Job lifecycle, progress messages | `src/lib/jobs.ts` |
| Rail, header, theme toggle | `src/components/app-shell.tsx` |
| Product name, default badge | `src/lib/brand.ts` |
| API keys & icon: storage, precedence | `src/lib/settings.ts` |
| Cài đặt screen | `src/components/settings-client.tsx` |
| Studio layout & render submit | `src/components/studio-client.tsx` |
| Axis pickers / ControlNet / resolution | `src/components/control-panel.tsx` |
| Library grid & preview modal | `src/components/history-client.tsx` |
| Design tokens, shell geometry | `src/app/globals.css` |
| Theme persistence & no-flash script | `src/lib/theme.ts`, `src/lib/use-theme.ts` |
