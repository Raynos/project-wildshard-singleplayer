# SF63 follow-up: Pine's shafts, fringe and grain inside its grid cell (SHARD-PLATFORM, E435)

Standalone Pine runs the cinematic engine chain: volumetric shafts its day clock turns, a colour fringe and an overlay
grain. The grid page shell runs the clean chain (`emptyLook`), so none of the three existed inside Pine's cell
(`../sf63-gaps/README.md`, gap 2). Jake's G232 B asks that each shard bring its own look into its cell.

## How it works (generic: no shard is named)

| Part | Mechanism |
|---|---|
| The effects | `src/engine/render/regionCinematic.ts` (`RegionCinematic`, made by `Game.regionCinematic()`): a `VolumetricsEffect`, a `ChromaticAberrationEffect` and a `NoiseEffect` with the cinematic chain's own values (`CINEMATIC_FX` in `render/look.ts`, which `Game.buildComposer` now reads too) |
| Compiled once, neutral | `GridFrame.install` on the shell splices them into the page's one colour pass in the cinematic pass's order (fringe first, shafts next, grain after the LUT), at opacity 0 / offset 0, inside the install's single recompile. The march's program is compiled then (`warm`). A crossing writes uniforms only |
| Who carries them | The carried region (G232's carrier) whose chain is cinematic (`RegionPost.volumetric`, from its level's atmosphere). A clean chain (Driftwood) or a `replace` look (Nalati) carries none |
| Blend at the edge | Shaft opacity = w, fringe offset = 0.0006·w, grain opacity = 0.12·w, w = the cell's owner weight |
| Its clock | `FrameLookPort.post(instance).vol` is handed to the region's layered backdrop (`attachPost`) in place of `NO_VOL`. Pine's clock writes sun, fog colour and strength there; the writes are kept per region and reach the march only while that region carries it |
| Memory | The march runs into its own target (`VolumetricsEffect` gains `prepass` and `setParked`), parked at 1×1 until a region takes it and parked again on release. On a page whose viewmodels draw into the depth slices (E142: the phone page), the march reads the scene target's own depth: a depth texture is attached to that target only while carried (a renderbuffer the same size becomes a texture, re-set-up, never a recompile). On a page that already has depth readers (desktop: rays, AO) it reads the colour pass's depth texture |

## The checks

Code: `e7f5e8b2a`. Captures ran on candidates of the same source (`7575de9f5` over `e86ccb3f1`; the drive JSONs name
their build), iPhone 16 Pro portrait, phone tier, muted, Developer on, one browser through `scripts/browser-lane.sh`.

| Check | Result |
|---|---|
| Pine inside its cell | **Not measured yet.** Pine's runtime entry fails on every pin so far (SF57 P0: `Cannot read properties of undefined (reading 'width')` on `e86ccb3f1`, a refusal after `af0046be9`), so the drive stops on the cell edge line at owner weight 0.533 (`drive-pine-edge-*.json`) |
| At the edge (w 0.533) | Carried by weight: shafts 0.533, fringe 0.00032, grain 0.064. Pine's clock drives the shaft strength (0.299, not the 0.55 start), the scene depth texture is attached (`depth: scene`). That run's march target stayed 1×1: an effect spliced in after the composer's last resize never got a size. Fixed in `e7f5e8b2a` (`VolumetricsEffect.update` sizes it from the frame it composites); not re-measured |
| Programs | 192 → 193 at the edge: +1, the march's program, compiled at install |
| Shader errors | 0 (Pine edge, Nalati drive) |
| GL MB (`__sc_gl`) | Road 94.35 before and after (the effects are parked at 1×1). Edge: 153.1 → 149.6 (noise is ±2 MB). The inside figure is pending |
| Nalati (a `replace` look) | Carries none of it, as designed: `fx.carrier` null inside, the road read-back exact including `frame.chain.fx` (`drive-nalati-after.json`) |
| Unit | `test/grid-frame.test.ts`: compiled in once at install in the cinematic order; neutral and parked on the road; carried by weight with the march target and scene depth allocated only then; the region's clock reaches the march only while it carries; a neighbour's clock never does; a clean chain carries none; one recompile in all |
| Gates | tsc, layers, oxlint, check-graph (no rise of its own), ratchet, shard coupling, full vitest (the only red is HEAD's own AG7 rise, present without this change) |

**Still to run once Pine enters** (on a pin with the SF57 fix): the Pine drive before / after with `board.sh` boards
against SHARD SELECT (`../playtest-2-drivein/standalone.mjs`); the inside GL MB with the march target; the road
read-back after leaving; `scripts/parity.mjs` both tiers against the parent export; `scripts/test-facade-instancing.mjs`;
`node scripts/frame-floor.mjs --shards=grid --grid-scenario=runtime-travel` (desktop and the Simulator).

## Files

- `drive.mjs`: `../sf63-gaps/drive.mjs`; `frame.chain.fx` rides in `frame.chain`, so the road read-back covers it.
- `board.sh`: SHARD SELECT / grid before / grid after boards.
