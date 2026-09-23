# Explore World — the viewer mode (was "Build World")

**State:** `draft` 2026-09-22 — scope set by the user (E14): a **viewer, not an editor**, mobile portrait first; round-3 portrait mockups generating into `art/build-world/round-3-viewer-portrait/`. Waits on the user's picks (title layout, D1–D6 below) and the go. Owner: model agent (session wildshard-singleplayer-8d).

## Why (the user's words, 2026-09-22)

> "How would we for this game allow us to iterate quickly on models and graphics quality?"
>
> "Build world is just a VIEWER, not an EDITOR / BUILDER. The whole goal of entering the world in VIEWER /
> EXPLORER mode is that I can fly around, view models in detail, make screenshots and then prompt Claude Code
> for iterating fast."
>
> "I want to be able to provide guidance in a VIEWER / EXPLORER mode without having to play in first person
> and provide guidance from in-game screenshots."

The loop it serves: **look → screenshot → note → an agent fixes it → look again.** Today every graphics note
starts with walking there in first person with a sword in the frame; the model agents (E8, the Driftwood
remaster) need the same thing as a harness: any model, isolated, lit, from any angle, on the phone.

## Scope

| in | out (the user: "out of scope", "that's editing") |
|---|---|
| Title: **ENTER WORLD** + **EXPLORE WORLD** (the top-level UI is redesigned around the two) | "BUILD WORLD" as a name — it "triggered everything" |
| **World Explorer**: a god-view camera over the loaded shard — orbit, pan, zoom, fly; POI cards; tap an object → info card → **OPEN IN MODEL EXPLORER** | placing, moving, rotating, deleting objects; gizmos; outliner editing |
| **Model Explorer**: a catalog of every model; a turntable (solid / wireframe / facets / AO only; dawn–night light); **detail tiers** (phone / laptop / desktop LOD) side by side; creature clips to *watch*; a creature lineup for scale; A/B vs the mockup; **VIEW IN WORLD** | palette / colour editing, sliders that change a model, saving |
| **Screenshot + feedback** from any view → the feedback inbox (FEEDBACK-INBOX.md) with the view's context attached | top-down map with layers, spawn zones, nav / collider overlays |
| Mobile web **portrait first**; desktop works with the same UI and mouse / keyboard fly (three-freecam) | terrain sculpting / terracing, scatter / paint brushes, "play from here", first-person editor HUDs, the phone joystick map (r2-09) |

## Mockups (all in `art/build-world/`, codex gpt-6-sol)

The user reviews **portrait only** from round 3 on ("the desktop mockups are way too tough for me").

| mockup | verdict |
|---|---|
| round-1 `10-build-hub-split` | **in** ("sure") — the two-card hub |
| round-1 `11-model-phone-portrait` | **in** ("awesome") — the phone Model Explorer |
| round-2 `r2-03-select-in-world` | **in** ("really cool") — tap → card → OPEN IN MODEL EXPLORER; **plus the inverse, VIEW IN WORLD** |
| round-2 `r2-07-lod-tiers` | **in** ("really cool") |
| round-2 `r2-08-map-poi-cards` | **in** ("really cool") |
| round-1 `06`, `07`, `08`, `09`, `12`; round-2 `r2-02`, `r2-06`, `r2-09` | **out** — editing / builder UI |
| round-1 `01`–`05`, round-2 `r2-01`, `r2-04`, `r2-05`, `r2-10` | not commented; carried into round 3 as viewer-only portrait versions |
| round-3 `p01`–`p17` (`round-3-viewer-portrait/`) | **to pick** — title (p01 stacked, p12 split panels, p13 hero + sheet, p14 minimal), hub p02, turntable p03, catalog p04, creature viewer p05, A/B p06, tiers p07, POI world p08, select p09, feedback sheet p10, lineup p11, inbox list p15, low fly p16, close-up p17 |

## How it works

- **Entry.** The title's second button. It boots the same shard (`bootstrap()`, same terrain / sky / models,
  so what you see *is* the game) but skips the player, weapons, touch HUD, enemies' AI and the boundary
  force field; creatures stand / idle in place. `?explore=world` / `?explore=model&model=<id>` deep-link
  straight in (and are what a feedback note's "go there" reopens).
- **World Explorer camera.** Desktop: **three-freecam** (hxtnv/three-freecam, MIT, vendored as
  `src/explore/FreeCam.ts` — `package.json` / the lockfile carry other agents' WIP, and it is 260 lines):
  RMB look + WASD fly, MMB pan, Alt-drag orbit, wheel dolly, F frame. Phone: our own gestures on the same
  camera — one-finger orbit around a pivot, pinch zoom, two-finger pan, double-tap to set the pivot; no
  joystick (the user: no first-person feel). Collision-free, clamped above the terrain / sea.
- **POI cards.** World-anchored glass cards (HUT, LOOKOUT, WRECK COVE, RING SHRINE, JETTY, ROPE BRIDGE) from
  the ChunkDef's POI list, with a bottom strip of the same POIs → **FLY TO** (a smooth camera tween).
- **Select.** Tap / click → raycast against the model meshes → a cyan outline + bounding box + a card:
  name, source file, tris, draw calls, dimensions → **OPEN IN MODEL EXPLORER** · FOCUS · ISOLATE · 📷 · ✎.
- **Model Explorer.** A registry `src/explore/catalog.ts`: one entry per model — `{ id, name, category,
  file, anchor?: {x, z}, build(sky) → Object3D }`. World models are built at their real spot (their stilts
  and bases follow the real ground) and re-centred on the turntable; creatures come from `AnimalFactory`
  with their clips. Views: turntable (orbit / pinch), **SOLID · WIREFRAME · FACETS · AO ONLY**, light
  presets **DAWN · NOON · DUSK · NIGHT**, **DETAIL TIERS** (the same model built at phone / laptop /
  desktop tier, tris each + the island budget bar), **LINEUP** (every creature + a 1 m ruler), **A/B vs
  mockup** (slide / swap / fade against the matching `art/` mockup at a stored camera), **VIEW IN WORLD**
  (World Explorer flies to the model's anchor and selects it).
- **Screenshot + feedback.** 📷 grabs the canvas (no UI). ✎ opens the **FEEDBACK-INBOX** composer
  (`src/ui/Feedback.ts`, F3) with the frozen frame, the pen for circling, and an explore context instead of
  the player's: `mode`, camera pose, selected model id + file, view mode, light preset, tier, build id →
  SEND TO INBOX (and COPY AS PROMPT). An agent pulls it (`pnpm inbox:pull`) and its "go there" reopens
  the exact view via `?explore=…`.
- **Cost.** Explore mode is a lazy chunk (the title never pays for it). It renders the same scene, so it
  holds 60 fps where the game does; the turntable renders one model — cheaper than play.

## Build order (each row is a deploy)

| # | row | done when | status |
|---|---|---|---|
| X1 | **Title**: ENTER WORLD + EXPLORE WORLD (the picked layout), portrait first | both buttons on the phone title; ENTER WORLD unchanged | waits on the title pick |
| X2 | **World Explorer camera**: vendored FreeCam (desktop) + touch orbit / pinch / pan (phone), no player / HUD / AI, `?explore=world` | fly the whole island on the phone and the MacBook at 60 fps | |
| X3 | **Model catalog + turntable**: `src/explore/catalog.ts` (every Driftwood model + creature), catalog grid, turntable, view modes, light presets, stats | every model opens on the phone; wireframe / facets / AO toggles | |
| X4 | **Select + cross-links**: tap → outline + card → OPEN IN MODEL EXPLORER; VIEW IN WORLD back | the round trip from the lookout and back | |
| X5 | **POI cards + FLY TO** | tap WRECK COVE → the camera flies there | |
| X6 | **Screenshot + feedback** through FEEDBACK-INBOX F3 with the explore context; `?explore=` "go there" | a note filed on the hut turntable reopens the hut turntable | needs FEEDBACK-INBOX F2–F4 |
| X7 | **Detail tiers** view + island budget bar | palm / hut at 3 tiers side by side with tris | needs per-tier builders (E8) |
| X8 | **Creature viewer + lineup** (watch clips, skeleton overlay, variants; lineup with ruler) | every creature plays every clip | |
| X9 | **A/B vs mockup** (stored camera per mockup, slide / swap / fade) | the wreck vs `driftwood-fp-poi-2-wreck-cove.png` | |

X2 + X3 are also the model agents' harness — they come first after X1.

## Decisions for the user

| # | question | options |
|---|---|---|
| D1 | Title layout | p01 stacked buttons under the card deck · p12 two tall split panels · p13 hero + bottom sheet · p14 minimal |
| D2 | Hub or straight in? | the p02 hub (MODEL / WORLD cards) · straight into World Explorer with a MODELS \| WORLD tab |
| D3 | Is Explore World public on the live site, or unlocked like the feedback inbox (review password)? | public · password-unlocked · dev only |
| D4 | Pine Hollow too, or Driftwood only for v1? | Driftwood only · both |
| D5 | Screenshot button: to the inbox only, or also save to Photos / download? | inbox only · both |
| D6 | Creatures in World Explorer: frozen, idling in place, or live AI? | idle in place · live |
