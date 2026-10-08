# SF67 fix 3, slice 1: Driftwood's cove cover splat baked at build (E461)

**Partial.** Of fix 3, only the first bake has landed: Driftwood's Blender-cove cover splat. The rest of Driftwood's
code-built world (rockKit boulders and small rocks, hibiscus bushes, voxel AO, palms, colliders), the procedural cove
under the island and all of Nalati are still built at load. They remain open SF67 work.

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
