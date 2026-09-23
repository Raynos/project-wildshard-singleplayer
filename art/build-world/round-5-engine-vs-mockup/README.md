# Round 5 — Explore World: in engine vs mockup

One board per screen: in-engine iPhone 14 portrait capture (left) vs the round-3 / round-4 mockup (right),
both scaled to 1400 px high. `00-overview.jpg` is all eleven on one sheet. Round 6 (`../round-6-midway/`)
is the "midway" answer: the in-engine screen, edited by codex into what it looks like done properly.

**Score** = how close the in-engine screen is to its mockup (10 = indistinguishable).
Captures 02, 04 and 05 did not reach the state the mockup shows (hub, a selection, the map sheet).
They are scored on what is on screen and flagged, because what is on screen is what the phone showed.

| # | Screen | Score |
|---|---|---|
| 01 | Title / entry | **7** |
| 02 | Hub | **2** (capture shows the loader, not the hub) |
| 03 | World flight | **4** |
| 04 | World select | **2** (nothing selected) |
| 05 | World map | **1** (map sheet not open) |
| 06 | Model catalog | **4** |
| 07 | Model turntable | **3** |
| 08 | Model facets / close-up | **2** |
| 09 | Model LOD tiers | **2** |
| 10 | Creature viewer | **3** |
| 11 | Note sheet | **4** |

The common thread is that the Model Explorer puts every model on a **flat pale-blue sky with white clouds,
over an opaque navy disc**, with no studio lighting. The model sits at about 15 % of the screen width, with
nothing under it to ground it. That setup is behind the "plain white backgrounds with blue circles" reaction,
and it affects 06–10 at once. The layouts and the UI chrome (top bar, toggles, info panel) already match
the mockups quite closely; the problem is how the 3D scene is presented.

---

## 01 Title — 7
- **Title type**: stacked small "PROJECT / WILDSHARD" vs one heavy, big display line → single-line 2-weight title, larger, tighter tracking.
- **Backdrop dimmed**: a dark scrim flattens the hero island → lighter gradient scrim only behind text, keep the hero saturated.
- **Cards**: heavy opaque dark footers, no corner brackets → frosted glass footer (backdrop-filter blur), 1 px cyan corner brackets, soft glow on hover/press.
- **Clutter**: long credits line at the bottom → move credits to a settings/about sheet; keep "SOUND ON" only.

## 02 Hub — 2 (loader captured)
- **Black void**: bottom 60 % empty black on the loader → show the hero island render / poster behind the loader, blurred, fading in as the chunk loads.
- **Hub cards not reached**: capture again after load; the hub needs the MODEL / WORLD explorer cards with thumbnails, as in the mockup.
- **Loader is a debug log**: step timings in monospace → keep one progress bar and one current-step line; log behind a "details" disclosure.

## 03 World flight — 4
- **Water**: flat untextured cyan, no waves or glints → normal-mapped / Gerstner water with sun specular, fresnel, shore foam band, depth colour ramp.
- **Grading**: washed-out, low contrast, sky and sea the same value → ACES tone map + a LUT, sun at ~35° with warm key, stronger shadow contrast.
- **HUD telemetry illegible**: thin grey text straight on the sky → put it on a small glass strip with a text-shadow; bump weight.
- **Controls**: joystick is a grey blob, no camera button → glass ring with cyan hairline + "FLY" label inside; add the screenshot button next to the pencil.
- **Artifacts**: bright white smear under the boat, clipped pier → fix the foam/decal sorting; frame the spawn looking at the cove, not off it.

## 04 World select — 2 (no selection)
- **Selection not shown**: the tap did not select → re-capture; a selection needs an outline (inverted-hull or post outline pass), a 3D bbox with a dimension tag, and the glass card.
- **Boulder shading**: crushed navy facets, near-black → lift the ambient (hemisphere light + env map), cap shadow darkness, warm/cool facet split.
- **Shadow**: hard, aliased, with red fringes → PCF soft shadows or a baked contact AO blob under props.
- **Blur**: a green/orange smear across the bottom third → the DOF / near-plane blur is wrong at low altitude; turn it off or focus on the look-at point.

## 05 World map — 1 (map not open)
- **Nothing to compare**: the frame is the flight view at 0 fps → re-capture with the sheet open.
- What the sheet needs (from the mockup): a rendered top-down island (ortho camera to a render target, not a flat canvas), glass pin tags, a view-cone "you are here", a scale bar, and a slide-up sheet animation.

## 06 Model catalog — 4
- **Thumbnails**: every model on a flat pale-blue sky above a navy half-disc → render thumbnails in a studio scene: dark radial gradient backdrop, fading floor grid, contact shadow, key + rim light.
- **Framing**: pier / jetty / rope bridge are hairlines, wreck cove and boulder are unreadable → auto-frame by bounding sphere + per-model thumbnail camera (3/4 angle, fill 75 %).
- **Odd shapes**: hibiscus renders as a lime slab, boulder as a flat facet sheet → check normals / materials in the thumbnail pass (flatShading + correct light).
- **Cards**: dark opaque blocks → glass tiles, corner brackets, a triangle icon + count on one line with the name.
- **Missing / rough**: no search field or PROPS chip; "0.0k tris" (boulder) → print raw counts under 1 000.

## 07 Model turntable — 3 (the one Jake flagged)
- **Backdrop**: flat pale-blue sky + white low-poly clouds → dark studio: vertical gradient, radial glow behind the model, floor grid fading into fog (scene.fog + a grid shader with distance fade). Or a studio HDRI (RoomEnvironment → PMREM) for reflections.
- **Stage**: opaque navy disc + grid square → a thin glass turntable: MeshPhysicalMaterial (transmission / clearcoat), cyan emissive rim ring, a soft contact shadow (three's ContactShadows approach: depth render + blur), a faint reflection (Reflector at low opacity, or SSR off / planar at half-res).
- **Lighting**: none visible → key (warm dir, soft shadow), fill (cool hemi), rim (back light, cyan-white) + env map for facet speculars.
- **Scale**: the hut fills ~15 % of the width → auto-frame to ~55 % width; ease the camera into place on open.
- **Info panel**: cramped, truncated "2 o…", no actions → bottom sheet with a grab handle, big title, one stats line, SCREENSHOT / FEEDBACK / VIEW IN WORLD row; drag/pinch hint on first open.
- **Post**: none → UnrealBloom (threshold high, only cyan UI glows + rim), vignette, SMAA; all within the phone's budget, since this is one model.

## 08 Model facets / close-up — 2
- **No close-up**: the mockup is a zoomed camera inside the model; the engine is the same tiny hut → pinch-zoom with a close-up preset, and show "ZOOM 4.2× · tris" in a tag.
- **Facet lines invisible**: overlay is faint grey on dark roof → an EdgesGeometry / barycentric wire shader in cyan with additive glow, depth-tested over solid.
- **Active toggle unreadable**: pale cyan chip on pale sky → fixed by the dark backdrop; plus an active-state glow.

## 09 Model LOD tiers — 2
- **Overlapping labels**: "DESKTOP 507" and "PHONE 407" render on top of each other → lay tiers out side by side (or stacked cards as in the mockup), one label per tier under its model.
- **Overlapping models**: both palms stand in one spot → offset each tier on its own pedestal, or split-screen with synced orbit.
- **Missing budget context**: mockup has the island-triangle budget bars → add the budget bar strip (it is cheap DOM).

## 10 Creature viewer — 3
- **Same studio problem** as 07 (flat sky, navy disc, no light, tiny model) → same studio fix; frame the boar to ~60 % width.
- **Missing creature tools**: animation clip bar (IDLE / WALK / TROT / CHARGE / HIT / DIE), play/scrub, speed, variants, skeleton toggle → DOM row + AnimationMixer; skeleton via SkeletonHelper with a cyan material.
- **Static pose**: the boar stands frozen → play idle by default on the turntable.

## 11 Note sheet — 4
- **Screenshot preview**: a narrow portrait strip letterboxed in a black landscape box → fit the preview box to the capture's aspect (portrait), rounded corners.
- **Sheet look**: flat olive-grey panel → glass bottom sheet with a grab handle, over a still-visible (blurred) world.
- **Context**: six grey key/value boxes → three compact chips (location, model, build), as in the mockup.
- **Type**: placeholder text large and dim → one-line input, larger send button with an icon, tags as a segmented control.

---

**What gives the biggest jump for the least work** (the midway mockups in round 6 confirm it): a single shared
**studio scene** for the Model Explorer, used for both the turntable and the catalog thumbnails. That means a
dark gradient backdrop, a grid fading into fog, a contact shadow, a glass disc with a cyan rim, a three-point
light rig with a PMREM env map, auto-framing, and light bloom and vignette. It changes five of the eleven screens at once.
