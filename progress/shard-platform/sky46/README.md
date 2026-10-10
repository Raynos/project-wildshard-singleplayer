# op-sky46: Nalati / Nine sky environment light and Pine's god rays in their cells (SHARD-PLATFORM G321 part 5, E435, 2026-10-10)

Captures: muted Metal iPhone 16 Pro portrait, phone tier, 2×, Developer on, Memory saver on, DEVSERVER builds
(`serve-build.sh --devserver`): **before** = HEAD `7b60b1941`, **after** = candidate `9e14f020b` (this change), with
Debug ▸ Sky & weather ▸ Grid cell sky light on B (`ROW=on`). `capture.mjs` is op-sky43's plus every composer effect with
its opacity, the scene environment, `SUN=1` (a second shot facing the sun), `PROBE=rays` and `MEM=1`. 0 page errors and 0
console errors in every shot.

## What differed, and the fix

| shard | difference | cause (readout) | fix |
|---|---|---|---|
| Nalati, Nine Dragon | darker ground (Nalati) | standalone binds its painted sky's PMREM environment (384×512, intensity 0.6 / 0.5); the cell bound none (`envMap: null`) | generic, **default off behind ONE Debug row** (`gridSkyEnvironment`, Sky & weather, A / B): a level with no backdrop and a painted sky lays its standalone sky environment as an **environment-only layer** on the page sky (`SkyRig.layeredEnvironment`, `paintedSkyEnvironment`, `BackdropLayer`'s `environment`): texture swapped in at half owner weight like a backdrop cell's, intensity from what the level's clock writes on its own scene (seeded with its `envIntensity`), every light / fog / disc value left to the level's own light swap. Charged on the cell's `sim-sky:` claim: **1,572,864 B** (reserved = held) |
| Pine Hollow | no god rays in the cell (SHARD SELECT 0.9) | the grid shell's tier knobs leave the rays out (`godRays: false`), so the page chain had no `GodRaysEffect` to carry (post knob −1) | generic (no row: a carried effect, same as the shafts / fringe / grain): `RegionCinematic.rays`, built by `Game.regionCinematic()` exactly as the chain builds its own when the page has none, placed after the shafts at 0, passes skipped at 0 or with the sun out of view (`skipRaysOffscreen`); a region whose chain draws rays takes them (`takeRays`, scene depth shared with the shafts) and the frame's knobs / its clock turn the opacity (`chainKnobs` mixes from the page's 0) |
| Pine Hollow | ground greyer and cooler | its day clock's hour: the grid's sun is higher (sun.y 0.469 vs 0.452), so its key is whiter ([1, .825, .671] vs [1, .796, .62]) and its fog bluer; not an effect the cell drops | none (same clock, a different moment) |

Readouts after (inside the cell): Nalati env 0.6 on a 384×512 PMREM, ground band mean **104.8 → 117.4** (SHARD SELECT
115.2); Nine env 0.5 (its own Jiehua materials barely read it: 90.5 → 90.6, SHARD SELECT 89.9); Pine `GodRaysEffect@0.88`,
carrier pine-hollow, post knob rays −1 → 0.88. With the row on A nothing changes for Nalati / Nine (no layer is built).

Boards (SHARD SELECT · grid before · grid after, same pose): `nalati-grasslands-board.jpg`, `nine-dragon-stack-board.jpg`,
`pine-hollow-board.jpg`; `pine-hollow-sun-board.jpg` faces the sun; `pine-hollow-rays-probe.jpg` is the cell facing the sun
(disc at NDC 0.02, 0.11, shown) with the carried rays at 0.87 against the same view with them forced to 0 (`PROBE=rays`).

Memory with the row (`MEM=1`, the candidate build, row A vs B, inside each cell): A builds nothing (`envMap: null`, claim 0);
B holds one 384×512 RGBA16F PMREM target per cell, **1,572,864 B**, reserved = held on `sim-sky:<cell>` for Nalati and for
Nine (the 512×256 painted equirect is freed once filtered). The probe's `gpuBytes` reads 0 outside a harness build. The
frame floor on Nalati's cell entry with the row on was not run: no push-free quiet window freed (`.git/quiet` held).

## Left as is

- Signal Dunes' ridge ring (G99: the horizon yields in the grid), per the brief.
- A backdrop-less level whose sky is an HDRI file (the template shards) carries no environment: that would be a download
  and a 2k texture; none of the brief's cells needs it.
- The carried rays' programs link at the first frame they draw (inside the cell), not at the install.
