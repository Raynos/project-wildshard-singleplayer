# SF67 fix 3: Driftwood's cove cover splat and Nalati's voxel AO baked at build (E461)

**Partial.** Two bakes have landed: Driftwood's Blender-cove cover splat (slice 1) and Nalati's world voxel AO
(slice 2, below). Still built at load: Driftwood's rockKit boulders and small rocks, hibiscus bushes, palms, voxel AO
(baked but not yet matched in the page, see slice 2), colliders and the procedural cove; Nalati's geometry, paint and
colliders. They remain open SF67 work.

The cover bake now sits beside island.glb in `public/assets/models/driftwood-blender/` (slice 1 put it under
`public/assets/baked/driftwood-isle/`, an asset folder the shard does not own: +2 shard-sandbox debt, now 0).

## What changed

- `scripts/bake-island-cover.mjs` runs the page's own functions (`islandProtos`, `islandSets`, `coverTrianglesOf`,
  `islandCoverBlock` in `src/shards/driftwood-isle/world/`) in Node, once per tier (a child process each, with the
  tier set before the modules load). It writes `public/assets/baked/driftwood-isle/island-cover.<tier>.bin`
  (53.6 KB each: a 16-byte header and 2 744 cells × 5 f32).
- `BlenderIsland.build` fetches the file with the island's other files. When the file fits (same version, placement
  count and rect), the build writes the block back (`CoverGrid.writeBlock`); otherwise it runs the splat in code.
  `splat` overwrites the whole area from the island's own files, so the block does not depend on anything built before it.
- **Stale gate and parity:** `bake-check.mjs` runs `bake-island-cover.mjs --check`, which rebuilds the bake byte for
  byte, so a source or asset change without a rebake fails the gate. In Node the two paths match bit for bit (both
  run in V8, as Chromium does). Safari's `Math.exp` may differ in the last bit of a double, so it is not proven
  bit-identical on WebKit.
- The bake replaces about 0.27 s (phone set) to 0.32 s (desktop set) of single-thread splat at 1× CPU (Node, M-series).

## Matched Driftwood captures (4× CPU, iPhone 16 Pro emulation, muted, SHARD SELECT → ENTER WORLD)

Before `eb21e476c`, after `8defd3bea` (the candidate tree; the landed commit adds only the map rebake and this
report). Order: before, after, after, before. **The machine was heavily loaded** (load average 37–60, with other
agents' suites running), so every time is about 1.5× sp-x5's quiet-machine numbers. Treat them as noisy single
observations.

| Arm | cold play ms | cold Props-end ms | warm play ms | warm Props-end ms | `coverTriangles` in trace |
|---|---:|---:|---:|---:|---|
| before | 12 017 | 8 012 | 10 468 | 7 204 | yes |
| after | 8 257 | 5 346 | 9 793 | 6 368 | **gone** |
| after (2) | 10 911 | 7 441 | 11 345 | 7 399 | **gone** |
| before (2) | 12 212 | 8 220 | 12 410 | 8 268 | yes |

The after arms are faster in both orderings: cold −1.3 to −3.8 s and warm −0.7 to −1.1 s. The load is too noisy to
put a number on the saving. The `coverTriangles` owner appears in every before trace and in no after trace. GL
resources are unchanged (439 geometries and 85 textures in every run). The JS heap at playable is the same within noise.

Files: `before/`, `after/`, `after2/`, `before2/` hold the capture summaries. The traces are not kept (size).

## Slice 2: Nalati's world voxel AO (and Driftwood's, not yet matched)

Where the time goes (Node CPU profiles of the real world builds, `scripts/bake/worldHost.mjs`, under load 100+, so
only the shares count): Nalati's world build 3.8 s of which `voxelAO` 1.1 s (29 %); Driftwood's 2.7 s of which
`voxelAO` 0.58 s, rockKit 0.63 s, the Blender island 0.78 s, drawn-hull colliders 0.2 s. The voxel AO is the one owner
both worlds share, so it went first.

- `src/engine/world/voxelAO.ts` keys every call by a 64-bit hash of its inputs (positions, normals, index, params,
  ground columns). `addVoxelAOBake(bytes)` adds a table; a hit returns the recorded values bit for bit, a miss marches.
- `scripts/bake-voxel-ao.mjs` builds the world in Node per tier, records, and writes one merged table:
  `public/assets/nalati/baked/voxel-ao.bin`, 2.78 MB (747 KB brotli), 71 geometries over both tiers. `--check` is in
  bake-check; `--verify` builds as the page does: Nalati 61 / 61 answered on both tiers, 0 marched.
- Nalati's props step runs inside `withVoxelAOBake` (`src/shards/nalati-grasslands/boot/voxelAOBake.ts`).
- **Driftwood is baked but not wired.** In Node all 7 Driftwood kits hit, but the matched page capture showed its
  kits still marching (voxelAO.ts self time unchanged, ≈ 256 ms), so the page gives them other inputs than the Node
  host does (most likely the ground columns: the G164 hybrid boot's dropped terrain against the host's terrain.bin).
  Its table would only cost the download, so it was left out. Open.
- In the page Nalati still spends ≈ 300 ms in voxelAO.ts (cold, 4×): about a third is the input hash and some
  geometries still march (the same host / page gap as Driftwood, smaller). Open: hash in the bake only what can
  differ, and find the misses.

Matched captures (4× CPU, iPhone 16 Pro emulation, muted, SHARD SELECT → ENTER WORLD). Before = HEAD `a910e3bd8`,
after = `a910e3bd8` + this change (the measured candidate also carried the Driftwood wiring, which only adds a
missed lookup). Order: after, before, then before, after. Summaries: `slice2/<arm>/` (traces not kept).

| Arm (load avg) | Nalati cold play / Props | Nalati warm play / Props | voxelAO.ts self, cold | Driftwood cold play |
|---|---:|---:|---:|---:|
| after (10) | 9 901 / 5 014 | 9 565 / 4 792 | ≈ 302 ms | 6 795 |
| before (28) | 11 506 / 5 883 | 10 851 / 5 519 | ≈ 611 ms | 7 154 |
| before (load 39 to 85) | 14 177 / 7 200 | 12 983 / 6 579 | ≈ 746 ms | 9 940 |
| after (load 85 to 36) | 10 803 / 5 318 | 10 399 / 5 174 | ≈ 493 ms | 7 756 |

GL resources are unchanged (Nalati 120 geometries, 125 textures in every run); the JS heap at playable is within
noise. The table is dropped once the world is built. The machine load moved between 10 and 85 during the runs, so
the play-time differences are noisy; the voxelAO.ts self time halving is the direct evidence.

Parity: a hit returns the exact Float64 values the code computes in V8 (`--check` rebuilds them byte for byte, the
test pins the round trip), so colours are bit-identical in Chromium; no collider or placement changes (no physics or
pixel diff needed for this slice). Safari may compute the AO's last bits differently (`Math` differences), so on
WebKit the baked values are V8's, not its own: not proven bit-identical there.
