<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AIRender

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

**Custom properties resolve where they are declared.** `--module-soft` is derived from `--module` on `.vx-shell` itself, not on `:root`, because a `var()` inside a custom property is substituted against the element carrying the declaration. Setting `--module-soft` inline alongside `--module` is what broke dark mode once — the inline light tint outranked the dark override and produced white-on-white.

## Architecture rules

**Provider abstraction is load-bearing.** API routes and UI never import `@fal-ai/client` or `replicate` directly — everything goes through `RenderProvider` in `src/lib/providers/types.ts`. To add a backend, implement the interface and append to `PROVIDERS` in `providers/index.ts`; nothing else changes.

A provider is really an *engine*, and engines differ in kind, not just vendor:

- `supportsControlNet: false` (Nano Banana) means there is no control map and no adherence dial. The UI hides the ControlNet panel and the diffusion knobs entirely rather than disabling them — showing a slider that silently does nothing is worse than showing none.
- `promptStyle` decides prompt grammar. `"describe"` composes a scene description for models steered by a control map; `"instruct"` composes an edit instruction, leading with the hard preservation clause, for models that receive the source image directly. Changing engine recomposes the prompt in the new grammar.

Both fal-hosted engines share `FAL_KEY`; credential and upload handling lives in `providers/fal-shared.ts` so they cannot drift apart.

**Model endpoint slugs are env-overridable.** fal rotates them. Defaults live in each adapter's `MODELS` map, overridable via `FAL_MODEL_*` / `REPLICATE_MODEL_*`.

**Rendering is a background job, not a long request.** `POST /api/render` writes the DB row, spawns the job, returns `202 {id}`. The client polls `GET /api/render/[id]`. Live progress sits in a `globalThis` `Map` (`src/lib/jobs.ts`); durable state is SQLite. Don't convert this back to a synchronous request — renders take 20–90s.

**Images never go in `public/`.** They live under `storage/` and are served by `/api/files/[...path]`, which rejects any path escaping the storage root. Keep that guard.

**Config errors are 400, not 500.** A missing API key is the caller's problem. `resolveProvider` throws `ProviderError` specifically so the routes answer 400 with an actionable Vietnamese message.

## Prompt library

`presets.ts` composes prompts from three independent axes — Subject × Context × Lighting (23 × 8 × 7). Never flatten this back into a single preset list; the whole point is that a bridge in Cao Bằng karst and the same bridge over the Mekong are different renders from one model.

Every subject carries an `accuracy` clause naming the details that structure type gets wrong (cable spacing, span equality, catenary mast pitch, lane-count continuity). These are **positive** constraints because FLUX.1 dev ignores negative prompts — never move a constraint into `negativePrompt` and consider it handled.

Subject defaults encode how tightly each structure must grip its geometry: bridges and tunnels 0.92–0.97, railways 0.90, roads 0.85–0.90. Keep that ordering — `check:presets` asserts it.

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
| Studio layout & render submit | `src/components/studio-client.tsx` |
| Axis pickers / ControlNet / resolution | `src/components/control-panel.tsx` |
| Library grid & preview modal | `src/components/history-client.tsx` |
| Design tokens, shell geometry | `src/app/globals.css` |
| Theme persistence & no-flash script | `src/lib/theme.ts`, `src/lib/use-theme.ts` |
