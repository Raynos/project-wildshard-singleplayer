# Explore World — the viewer mode (was "Build World")

**State:** `in progress` 2026-09-23 — every row X1–X11 is built and live (X10 generic lands with this commit); left: the finishing pass — the user's phone look at the live build, then archive. Owner: session wildshard-singleplayer-8d (E14).

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
| **World Explorer** = **god mode in the real 3D world**: the actual game scene (same terrain, models, creatures, water, sky), a free camera that flies anywhere at any height and spins freely — skim the waves, hover beside the wreck, look up at the lookout from below; tap an object → info card → **OPEN IN MODEL EXPLORER** | placing, moving, rotating, deleting objects; gizmos; outliner editing; a stylized / map-like World Explorer where you tap POIs and jump (the user: "not some kind of cool stylized map where you click stuff and zoom in and jump to points of interest") |
| **Model Explorer**: a catalog of every model; a turntable (solid / wireframe / facets / AO only; dawn–night light); **detail tiers** (phone / laptop / desktop LOD) side by side; creature clips to *watch*; a creature lineup for scale; A/B vs the mockup; **VIEW IN WORLD** | palette / colour editing, sliders that change a model, saving |
| **Screenshot + feedback** from any view → the feedback inbox (archived: `project/archive/2026-09-22-feedback-inbox.md`) with the view's context attached | top-down map with layers, spawn zones, nav / collider overlays |
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
| **Model Explorer: all seven screens are in** (the user: "they all look great … do as many of them as you can") | p04 catalog, p03 turntable, p17 close-up, p05 creature viewer, p11 lineup, p07 tiers, p06 A/B |
| round-3 `p01`–`p17` (`round-3-viewer-portrait/`) | **to pick** — title (p01 stacked, p12 split panels, p13 hero + sheet, p14 minimal), hub p02, turntable p03, catalog p04, creature viewer p05, A/B p06, tiers p07, select p09, feedback sheet p10 (**in**), lineup p11, inbox list p15 (**out**: no notes list), low fly p16, close-up p17; **p08 as the main World Explorer screen is out** (map-like); its jump-to-POI idea lives on as the mini map (X5) — round-4 god-mode flight mockups |

## How it works

- **Entry.** The title's second button. It boots the same shard (`bootstrap()`, same terrain / sky / models,
  so what you see *is* the game) but skips the player, weapons, touch HUD and the boundary force field;
  creatures run their **ambient AI** (D6). Driftwood only (D4); the EXPLORE panel is public (D3). `?explore=world` / `?explore=model&model=<id>` deep-link
  straight in (and are what a feedback note's "go there" reopens).
- **World Explorer = god mode (the user, 2026-09-22):** *"not some kind of cool stylized map where you can
  click stuff and zoom in and jump to points of interest — it's the real world, the real 3D model in god
  mode, a full-on god mode where you can fly around and spin."* The frame is the game's own render at the
  game's quality; the camera is free: no body, no collision, no gravity, any altitude (under the sea too).
- **God-mode camera.** Desktop: **three-freecam** (hxtnv/three-freecam, MIT, vendored as
  `src/explore/FreeCam.ts` — `package.json` / the lockfile carry other agents' WIP, and it is 260 lines):
  RMB look + WASD fly, Q/E down / up, Shift fast, wheel = speed while looking, MMB pan, Alt-drag orbit,
  F frame. Phone (portrait): **fly stick** bottom-left (move along the view direction), **drag anywhere
  else to spin the view**, **▲ / ▼** altitude buttons on the right edge, a speed chip (slow / normal / fast),
  pinch = move forward / back; double-tap an object = orbit around it (release to free-fly again).
- **Getting around** is flying (primary). On top of it (the user, 2026-09-22: "I still really like the idea
  … you can jump to models … and a little map with jump to point of interest"):
  - **Mini map** — a small round map button (top-right) opens a compact island map sheet with POI pins
    (JETTY, HUT, RING SHRINE, LOOKOUT, WRECK COVE, ROPE BRIDGE) and your camera arrow; tap a pin → the
    camera **flies** there (a smooth tween, still god mode) and hands control back. ⌂ resets to the pier.
  - **Jump to a model** — tap any model while flying → outline + card → **OPEN IN MODEL EXPLORER**.
  - **Jump into the world from a model** — **VIEW IN WORLD** in the Model Explorer drops you into god mode
    at that model's **known camera point** (a stored hero view per catalog entry), model selected.
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
- **Feedback = one button, fire and forget (the user, 2026-09-22).** A single ✎ on every Explore screen:
  it freezes the frame (the screenshot, no UI), opens the p10 sheet — pen to circle, a note, context chips —
  and **SEND** hands it to the **finished** feedback inbox (`project/archive/2026-09-22-feedback-inbox.md`): Explore
  calls `new Feedback(host).openSheet()` (`src/ui/Feedback.ts`) with its own `FeedbackHost` whose `context()`
  returns the explore context below; sending already needs the review password (D3). Then it is gone: **no notes list, no history, no separate 📷 button** (p15 is out). The explore
  context replaces the player's: `mode`, camera pose, selected model id + file, view mode, light preset,
  tier, build id; the note's "go there" reopens the exact view via `?explore=…`, so an agent sees what you saw.
- **Cost.** Explore mode is a lazy chunk (the title never pays for it). It renders the same scene, so it
  holds 60 fps where the game does; the turntable renders one model — cheaper than play.

## Build order (each row is a deploy)

| # | row | done when | status |
|---|---|---|---|
| X1 | **Title**: ENTER WORLD + EXPLORE WORLD on the title, portrait first | both on the phone title; ENTER WORLD unchanged; the shard swipe is obvious | **built** — first as p12 split panels (4229421), then back to the swipe deck + two compact buttons (D1 revised) |
| X2 | **God-mode camera**: vendored FreeCam (desktop) + fly stick / drag-to-spin / ▲▼ altitude / pinch (phone) in the real game scene, no player / HUD / AI, `?explore=world` | fly the whole island — wave height to 150 m, under the pier, round the lookout — on the phone and the MacBook at 60 fps | **built** — src/explore/FreeCam.ts (three-freecam, vendored), TouchFly.ts, Explore.ts (hub, overlay, readout, ✎), explore.css; `?explore=world` deep link; 60 fps / 159 calls desktop |
| X3 | **Model catalog + turntable**: `src/explore/catalog.ts` (every Driftwood model + creature), catalog grid, turntable, view modes, light presets, stats | every model opens on the phone; wireframe / facets / AO toggles | **built** — src/explore/catalog.ts (17 models: 8 buildings live, cove, palm / boulder / bush built alone, 5 creatures on their own rigs), ModelExplorer.ts (catalog with composer-rendered thumbnails, turntable in the live scene, SOLID · WIREFRAME · FACETS · PAINT, DAWN · NOON · DUSK · NIGHT via the day/night clock, tris / calls / file, VIEW IN WORLD flight) |
| X4 | **Select + cross-links**: tap / click → cyan box + dimensions + a card (name · file · tris) → OPEN IN MODEL EXPLORER · ORBIT · ✕; VIEW IN WORLD lands with the model selected | the round trip from the lookout and back | **built** — src/explore/Select.ts: live models, one palm / bush out of its batch, every live animal; ORBIT = one finger (phone) / Alt-drag (desktop) round it |
| X5 | **Mini map + jump**: map sheet with POI pins → fly there; ⌂ spawn; a hero camera point per catalog entry for VIEW IN WORLD | tap WRECK COVE on the map → the camera flies there; VIEW IN WORLD on the hut lands on it | **built** — src/explore/MiniMap.ts: MAP button (M) → a top-down map drawn from the heightfield, a pin per `ChunkDef.pois` (the new optional field; Driftwood: jetty, hut, shrine, lookout, wreck cove, rope bridge), the camera arrow; tap a pin / the map → Explore.flyTo, ⌂ spawn |
| X6 | **Screenshot + feedback** through the finished inbox (`Feedback.openSheet()` + an explore `FeedbackHost`); `?explore=` "go there" | a note filed on the hut turntable reopens the hut turntable | **built** — notes from Explore carry `explore` / `cam` / `model` / `selected`; Feedback.reproUrl → `?explore=&cam=&model=` (test/explore.test.ts), the composer shows Explore · Camera · Heading · Model; a link lands on the exact camera / turntable (verified); ✎ asks the review password once on a locked device |
| X7 | **Detail tiers** view + island budget bar | palm / hut at 3 tiers side by side with tris | **built** — TIERS view: a batch member (palm / bush / boulder) rebuilt at the phone and desktop tier side by side (src/explore/tiers.ts `withTier`, core/tier.ts exports `TIER_TABLE`; palm 407 / 507 tris, bush 100 / 240); live models say one build for every tier; every model shows its share of the phone frame budget (≤ 2.0 M tris, ≤ 150 calls) |
| X8 | **Creature viewer + lineup** (watch clips, skeleton overlay, variants; lineup with height lines) | every creature plays every clip | **built** — on a creature's turntable: IDLE · WALK · TROT · CHARGE on a treadmill (the rig walks in place on the disc), HIT (stagger), DIE (and a fresh rig on the next clip), the species' variants as chips (catalog `rebuild`), SKELETON overlay, 0.5×; LINEUP in the catalog stands all five side by side smallest → tallest (crab 0.4 m … drowned sailor 1.8 m) with 0.5 m height lines and name / height / tris labels |
| X9 | **A/B vs mockup** (stored camera per mockup, slide / swap / fade) | the wreck vs `driftwood-fp-poi-2-wreck-cove.png` | **built** — src/explore/Compare.ts: COMPARE (world mode) → a picker of the four Driftwood first-person targets (spawn, lookout, wreck cove, ring shrine; 720 px copies bundled in the lazy chunk, 460 KB, loaded on open) → the camera flies to that mockup's viewpoint and the mockup lies over the live frame: SLIDE (drag the divider), FADE (slider), SWAP; the camera stays free to line it up; notes carry compare / mockup |
| X10 | **Generic, not Driftwood-shaped** (the user, 2026-09-23: "make the driftwood implementation generic after driftwood — don't build it for pinewood yet"): models self-register as their builders build them (`registerModel`), creatures come from the shard's own species, the mini map's POIs from `ChunkDef.pois`, the home pose / hub orbit from the shard's spawn and centre. EXPLORE stays Driftwood-only on the title (D4) until the user switches a shard on | Explore reads nothing Driftwood-specific; Pine Hollow / Nalati would work by adding `pois` + register calls | **built** — src/explore/registry.ts (`registerModel` / `registerPick`: a shard's setup registers what it built — Driftwood via `registerDriftwoodModels` in main.ts), `catalogEntries` = the registry + one creature per species the shard's AnimalManager has (in the shard's style), POIs from `ChunkDef.pois`, COMPARE targets per shard slug, the home pose and orbits from the shard's spawn / size, `ChunkDef.explore` gates the title's button and `?explore=` (true on Driftwood only). To turn Explore on for Pine Hollow / Nalati: `explore: true`, `pois`, register calls — no Explore code |
| X11 | **The studio pass** (the user, 2026-09-23: "plain white backgrounds with these blue circles … looks a bit shit" → a polished, shiny, wow dev tool; comparison `art/build-world/round-5-engine-vs-mockup/` scored the Model Explorer screens 2–4 / 10; target = `round-6-midway/`, codex edits of the in-engine frames): one studio scene for the turntable AND the catalog thumbnails — a dark gradient backdrop instead of the day sky, a grid fading out on a dark glossy floor, a glass disc with a glowing cyan rim (bloom), the model's real shadow + a soft contact shadow, the model framed to ~55 % of the width, glass tiles in the catalog, tier builds side by side on the camera's right axis with labels apart, glass bottom sheet. **Style guard (the user on the midways):** round-6 `04-world-select` is rejected — "way too photorealistic … not our style"; the polish is the stage, light and UI only, the models stay the game's faceted flat-shaded low-poly (`05-world-map` is the right register) | the hut / boar / palm turntables and the catalog read like `round-6-midway/07`, `10`, `06` on the phone | **built (first pass)** — src/explore/ModelExplorer.ts: the day sky swapped for a deep-blue gradient backdrop while a model is on show, a faint grid fading into the dark, a raised dark glass disc with an HDR cyan rim + halo, a soft contact shadow, the model framed to ≈ 60 % of a portrait screen; thumbnails from the same studio; tiers side by side on the camera's right axis |

X2 + X3 are also the model agents' harness — they come first after X1.

## Decisions for the user

| # | question | options |
|---|---|---|
| D1 | Title layout | picked 2026-09-22: p12 split panels → **revised 2026-09-23** by the user on the phone: "way too big … it does not make it obvious you can swipe to select another shard" → back to the swipe card deck (neighbours peek in, dots) with ENTER WORLD and EXPLORE WORLD as two compact buttons side by side under it |
| D2 | Hub or straight in? | **picked 2026-09-22: the p02 Explore hub** — two cards, MODEL EXPLORER and WORLD EXPLORER (`round-3-viewer-portrait/p02-hub.jpg`) |
| D3 | Public or locked? | **picked 2026-09-22: public on the live site, no password to explore.** Only *sending* feedback is gated — by the feedback inbox's own review password (Settings → REVIEW unlock) |
| D4 | Which shards? | **picked 2026-09-22: Driftwood only** — "everything we're building here, Driftwood only"; Pine Hollow stays experimental and gets no Explore mode. **2026-09-23:** make the Driftwood implementation generic (X10) but don't switch it on for Pine Hollow yet |
| D5 | Screenshots | **settled 2026-09-22:** the only in-game capture is the ✎ feedback (screenshot + note → inbox, fire and forget, no list). A plain screenshot = the phone's own screenshot |
| D6 | Creatures while you fly | **picked 2026-09-22: their ambient AI** — wander, graze, idle as in the game (no player, so nothing aggroes) |
