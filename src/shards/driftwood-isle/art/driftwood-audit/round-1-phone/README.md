# Driftwood Isle: phone audit, round 1 (2026-09-24)

A read-only tour of Driftwood Isle in **Explore World**, set up the way the user plays it on the iPhone. Nothing in the
game was changed.

- **Build:** live `f86b4c3-mugefola`.
- **Device:** agent-browser `set device "iPhone 16 Pro"` (402×874 CSS px, 3×).
- **URL:** `?explore=world&touch&tier=phone&mute=1`, the phone tier.
- **Camera:** placed per spot through `window.__world.game.camera`. The HDG readout is stale in these shots because of
  that placement.
- **Excluded:** the sail (Boat.ts), the pier pennant (Pier.ts), cloth shadow acne (E112) and the Model Explorer scroll.
  Other agents are fixing those.

**Contact sheet:** [`contact-sheet.jpg`](contact-sheet.jpg), with the top 9 findings labelled. Sheet 1–2 are bugs 1–2, sheet 3 is bug 4, sheet 4 is bug 3, and sheet 5–9 are T1–T5.

## Bugs: clearly wrong, safe to fix

Ranked by how much each one hurts the look on the phone.

| # | What | Shots | Source | Fix · cost |
|---|---|---|---|---|
| 1 | **No creature is ever drawn in Explore World.** Deer, boar, bears and crabs are all `mesh.visible = false`. `AnimalManager.update` measures the draw distance from `player.position`, and Explore parks the player at `PARK` (0, −600, −3000). Every animal is therefore past `animalHideDist` (150 m on phone, 400 m on desktop). The same distance also turns off their shadows and picks their LOD. With the mesh forced visible, the deer, boars and bear look good. | `23-deer.jpg` (empty) vs `23b-deer-forced.jpg`, `21b-boar-forced.jpg`, `22b-bear-forced.jpg` | `src/entities/AnimalManager.ts:551-553`; caller `src/main.ts:744`; `PARK` in `src/explore/Explore.ts:73` | Give `update()` a view position used only for visible / castShadow / drawLod / fur shells. Pass `viewer()` (main.ts:153, already used by grass and undergrowth), and keep `playerPos` for the AI. ~10 lines, 15 min. |
| 2 | **A horizon seam at altitude.** Flying high (110 m), the painted horizon's islands sit on a hard straight cut, with a flat pale band of fog between it and where the 3D sea ends. At sea level it lines up (`13-horizon.jpg`). | `17-overview.jpg`, `17c-horizon-seam-crop.jpg` | `src/world/HorizonMatte.ts` (cylinder R = 2300 m pinned at sea level) vs the ocean mesh's extent (`src/world/Ocean.ts`) | Carry a flat far-sea skirt ring out to the matte's radius in the sea's horizon colour, or lift the matte's bottom rows with the eye height. 30–60 min. |
| 3 | **Blocky foam rings.** The foam round pier piles, the boat and reef rocks shows up as flat white hexagon and rectangle cut-outs: the obstacle-proximity texture's texels, drawn at full strength. | `01c-foam-rings-crop.jpg`, `01b-boat-side.jpg`, `18-wreck-close.jpg` | `src/world/Ocean.ts:166-180` (ring term) + `foamAround` (:225, the G channel of the sea-floor texture) | Break the ring edge with the existing lace noise / a smoothstep band instead of a solid fill, or raise that texture's resolution near the pier. 30 min. |
| 4 | **Saturated blue terrain faces above the waterline in the gully under the rope bridge.** The ravine walls turn royal blue up to about 1 m above the water, as if tinted as seabed. Needs a look before it is fixed. | `11-bridge.jpg` | Most likely the below-sea colouring in `src/world/Terrain.ts` (~:521, the `h < 0` seabed lerp on faces that straddle 0), or the ocean's depth tint | Clamp the seabed tint to faces wholly below the sea, or grade it by the face's max height. 20–40 min. |
| 5 | **Phone shadows are coarse and blobby.** The tower's and palms' shadows break into bubbly blobs: 1024² over 80 m + 60 m margin is about 14 cm per texel, with no soft filtering. | `07-banner.jpg` (tower shadow on the sand), `05-hut-door.jpg` | `src/core/tier.ts:25` (phone `shadowMapSize: 1024, shadowFar: 80, shadowMargin: 60`) | Try `shadowFar 50` / margin 40 on the phone (the same map, ~2× sharper) and check fps on a real iPhone. 15 min + a phone check. |

## Taste: the user's pick (ship as switchable variants, never swapped unilaterally)

| # | What | Shots | Source | Suggestion · cost |
|---|---|---|---|---|
| T1 | **Lookout banner:** the other blue flag. A flat, saturated blue sheet (4×7 grid, ±7 cm wave) with a flat diamond. It is in the same "one or two steps better" class as the pier pennant, so keep the two consistent. The white foot bands sit 3.6 cm proud while the cloth waves up to 6 cm there, so the cloth can poke through them. | `07-banner.jpg`, `06-lookout.jpg` | `src/world/Lookout.ts:156-181`, colours `:34` | Swallowtail / V foot, a darker trim border, a tassel fringe, a crossbar with finials, deeper fold shading. Put the bands on the cloth's own wave. 1–2 h. |
| T2 | **Two rock palettes on one island.** The Wreck Cove and cave rocks are charcoal (`#383c43`–`#50555d`) and go near black in shade. The Blender spawn-cove boulders are pale grey. | `09-wreck.jpg`, `09c-cove-rocks-crop.jpg`, `10-cave-mouth.jpg`, `19-cascade.jpg` | `src/world/Cove.ts:50`, `src/world/Wreck.ts:66` | Lift and warm the greys ~25% toward the spawn boulders. Colour constants only, 10 min + an A/B sheet. |
| T3 | **Driftwood logs read as white styrofoam** under the midday sun. | `10-cave-mouth.jpg`, `09-wreck.jpg` | `src/world/Wreck.ts:65` (`drift #d2c6ae`, `driftC #e2d8c4`) | ~20% darker, warmer silver-brown. 10 min. |
| T4 | **The toon terminator band draws as a wide orange halo** round the soft phone shadows on sand. | `05-hut-door.jpg`, `07-banner.jpg` | `src/world/stylize.ts:117` (the terminator band), `src/gpu/toon.ts` | Narrow or weaken it on the phone tier, where shadows are blurry. 20 min. |
| T5 | **The Wreck Cove waterfall is a soft, blurred white-cyan curtain** with flat white ripple ellipses, out of step with the faceted world. | `19-cascade.jpg` | `src/world/Waterfall.ts` (used by `Cove.ts`) | A faceted, stepped curtain + stylised foam rings. 1–2 h. |
| T6 | **Large flat-shaded light / dark triangles** across the lagoon near the camera. The same "triangle" look the user flagged on the sail, but on the sea. | `01b-boat-side.jpg`, `03-beach-palms.jpg`, `11-bridge.jpg` | `src/world/Ocean.ts`, phone `oceanCell: 4.0` (`tier.ts:49`) | Ask whether it reads as intended toon water. If not, soften the facet normals near the eye. |

## Checked and fine

- The pier deck and piles, and the beach and palms from the pier (`02`, `03`).
- The hut and its porch (`04`, `05`).
- The lookout from the path (`06`).
- The ring shrine and its pool (`08`), which is the best-looking spot.
- The wreck hull, rigging and tattered sails (`18`).
- The rope bridge (`11`): its shadow's gaps are the plank gaps, which is correct.
- The deer, boar and bear models once they are drawn (`21b`, `22b`, `23b`).
- The cave interior (`20`, not kept): dark, as intended.
- 60 fps and ~1 M tris at every spot.

## Aside (not Driftwood)

On the phone, the Explore ▲ / ▼ buttons and the SPEED chip cover the right-centre of every frame, where the subject
usually is. A lower placement is worth considering along with the catalog-scroll work.

## Files

- `01…23*.jpg`: 402×874-view captures at ~1000 px tall.
- `*c-*-crop.jpg`: full-resolution crops.
- `contact-sheet.jpg`: the ranked sheet.
