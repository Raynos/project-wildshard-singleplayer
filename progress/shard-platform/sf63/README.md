# SF63: each shard looks like itself inside the grid (partial, E435)

Grid captures are real drive-ins (`drive.mjs`, from playtest round 2): a Developer-ON grid boot, a road pose, then held
input into the cell. iPhone 16 Pro portrait, muted, one browser via `scripts/browser-lane.sh`. Builds: before `eb74adfc4`,
SF63 = the candidate on `eb74adfc4` (same logic as the landed commit; the landed one routes the look through `SkyRig`).

## What changed

| Part | Mechanism | Default |
|---|---|---|
| **Grass** (Nalati's yellow steppe + grass on the road) | `LevelFrameBinding` binds the region level's resolved look parts with its level (`bindLevelSelection(level, look)`); `Grass.build()` reads `boundLevelLook()` before the page look. The region grows its own `LookStrategy.grass`, the same way its terrain painter was already taken from its own look | **On** (the region's own content, standalone untouched) |
| **Light model + fog** (Driftwood's toon bands and ramp fog, Nalati's painted fog) | `render/regionLook.ts`: the level's `lighting` / `fog` installs run once in a sandbox (`ShaderChunk` and the fog-uniform list snapshotted and restored exactly), the changed chunks are inlined per material under the region's root, last in the patch chain, with a `\|look:<level>` program key (a region-keyed program variant). Materials that reach no overridden chunk, and asset-cache shared materials, are left alone | **Off**: the existing Debug row, renamed **Region look** (B = the region's own sky, light and fog) |

Why per-material overrides: a frame-level `ShaderChunk` switch at cell entry recompiles every page program (road,
neighbours, viewmodel) on each crossing and gives a neighbour drawn in the same frame the wrong look.

## Grid Nalati, entry road looking E and inside looking E

`nalati-entry-road-e.jpg`, `nalati-inside-e.jpg`: before / SF63 row A / SF63 row B.

- **Before**: grass tufts carpet the dirt road (the engine carpet reading Nalati's splat wrongly).
- **A (default)**: the road is clear dirt, the verge is Nalati's GrassV2. Fixed.
- **B**: also Nalati's sky (G223) and painted fog. The fog reads too thick near the camera: the fog uniforms Nalati's look
  runtime drives standalone (`wireLookV2`) are not yet driven in the grid. Open.

| Run | Shader errors | Programs (entry / inside) | Region-look materials patched |
|---|---|---|---|
| before | 0 | 133 / 133 | – |
| A | 0 | 134 / 134 | – |
| B | 0 | 144 / 144 | Driftwood 90, Nalati 103 |

## Not done in this lane (90 min cap)

- Driftwood and Pine drive-ins (the `driftwood` scene is in `drive.mjs`; the run was cut at the cap), the SHARD SELECT
  references (`standalone.mjs`), standalone parity (`scripts/parity/compare.mjs`), GL MB inside / outside (the harness
  `gpuBytes` read null on this page), `scripts/test-facade-instancing.mjs`.
- Nalati B's fog uniforms (its look's per-frame driver) and Driftwood's `uToon*` clock driving inside the grid.
