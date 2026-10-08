# Nalati G227 provisional residency estimate — 2026-10-08

**ESTIMATE ONLY. G227 remains open.** Current full-detail-L1 planning allowance: approximately **230 MB**, with a rough **200–270 MB** range for entered tiled world residency, dependencies and provisional cache growth. Decimal MB before the 1.11 model factor. This is neither an admitted product nor a bound. No native render owner has been retired by this bake yet; **credited retirement is zero**. The target remains at least **100 MB net accounted saving**, with residual runtime plus tiles at most **389.909910 MB**, including net growth elsewhere.

| Input | Bytes / MB | Evidence and limits |
| --- | ---: | --- |
| Native painter ground arrays, CPU plus GPU | 12,558,384 B | 6,279,192 B of actual positions, normals, colours, surf/rdir/zone and indices, counted twice; excludes textures and JS objects |
| All 64 emitted ground L0 tiles | 15,080,848 B | Exact GLB parser decoded + GPU costs |
| Largest 40 emitted ground L0 tiles | 9,613,284 B | Conservative tile-count envelope, not the actual entry selection |
| All 16 emitted ground L1 parents | 13,615,232 B | Initial L1 retains native triangles and custom channels |
| Ground: largest 40 L0 plus all 16 L1 | **23,228,516 B** | Parent masking does not dispose the parents; excludes far, textures and retained wire/cache |
| Captured static attributes, Float32 interpretation | 53,039,592 B | Deduplicated 50 static meshes from the committed capture; original attribute storage types were not recorded |
| Captured static front instance matrices/colours | 2,782,968 B | Capacity times 76 B; includes scatter capacity, not just initially visible copies |
| Captured static indices, Uint32 interpretation | 5,938,824 B | Capture synthesizes indices for non-indexed source meshes, so these are not proved native allocations |
| Static geometry/front instances, CPU plus GPU | **111.65–123.52 MB** | Float32 planning interpretation, excluding/including capture indices; not a measured retirement claim |
| Scatter original source arrays | 3.51 MB | 36,553 copies at 96 B: matrix, tint, position and range; additional cell/planner objects unmeasured |
| Eleven phone static-model atlases | 15.38 MB | Original 512×512 image dimensions, conservative full RGBA mip charge; no final hash dedup |
| Seven phone world maps | 9.79 MB | Meadow/path/gravel/rock/snow/bark/felt, 512×512; includes conservative candidate material coverage |
| Known candidate texture subtotal | **25.17 MB** | Excludes generated sign atlas and possible other source maps; not emitted KTX2 costs or measured native GL |

The approximate total uses **140–201 MB static geometry/instances**, **23.23 MB ground**, **25.17 MB known candidate textures**, **2–6 MB forest**, **1.6 MB far**, and **5–10 MB product/cache growth**; rounded to 200–270 MB. The static allowance assumes full-detail L1 retains approximately one complete source representation and near L0 adds roughly 25–62.5% of it. That fraction is a sensitivity assumption, not measured spatial residency. Clipping, per-tile geometry replication, instance retention, material identity and the actual entry pose can change it. Forest and cache figures are provisional allowances, not measurements. The existing far claim is already charged in the platform ledger: include only its replacement delta when calculating net growth, rather than adding a second far claim.

The directly identifiable native world footprint is roughly **150–175 MB CPU/GPU/source arrays** under the same Float32/texture assumptions. It is **not** an isolated accounted subdivision of the reviewed **489.909910 MB** runtime claim. Retained source models, decoded images, closures and generator heap may add cost but remain unmeasured. Native WSTR/collision, dynamic actors, gameplay, sky/weather/water, render targets and unclassified resources remain in the residual. Do not subtract either this estimate or the old 299 MB calibration from the opaque claim.

Consequently there is **no established positive net saving**. At the central 230 MB replacement allowance, the target would need approximately 330 MB of proved retirement, after reconciling already-charged far/cache ownership. Current evidence does not establish that. In particular, initial ground tiling costs more than its source arrays. The full-detail L1 sensitivity is a warning, not a proposal to ship that larger representation: proceed with the product pipeline, preserve instancing and compressed source textures, and use an error-measured smaller L1 with rendering-owner fidelity review. No renderer, asset format cost policy or live boot switch changes in this receipt.

Sources: [real capture](nalati-authored-capture-cd1890836/summary.json), [deduplicated assignments](nalati-static-assignment/assignments.json), [scatter source contract](nalati-scatter-source.md), [budget acceptance equation](../../memory/g227-budget/README.md), `scripts/bake/nalatiGroundSource.ts`, `scripts/bake/nalatiCaptureInventory.ts`, and `src/game/shardfile/assets.ts`. Model atlas candidates: eagle, cauldron, firewood, chest, kumis-churn, saddle, watchtower, snow-lotus and boulder-1/2/3 under `public/assets/nalati/models/*.phone.glb`. Their original PNG headers are 512×512; seven world maps are under `public/assets/nalati/tex/*.phone.webp`. A 512-square full mip chain is 1,398,100 RGBA bytes. The parser currently charges that RGBA bound even when KTX2 wire bytes are compressed; sp-x2 is auditing the model against measured per-owner memory.

Reproduce emitted ground costs from a clean committed tree (no browser, renderer or native physics world):

```js
// node --experimental-transform-types --import ./scripts/bake-loader.mjs --input-type=module
import { readFileSync } from 'node:fs';
import { installBakeEnvironment } from './scripts/bake/environment.mjs';
const environment = installBakeEnvironment(process.cwd());
try {
  const { nalatiGroundSource, bakeNalatiGround } = await import('./scripts/bake/nalatiGroundSource.ts');
  const source = nalatiGroundSource(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
  const tiles = bakeNalatiGround(source);
  for (const lod of [0, 1]) {
    const rows = tiles.filter(row => row.tile.lod === lod);
    const sizes = rows.map(row => row.cost.decoded + row.cost.gpu).sort((a, b) => b - a);
    console.log({ lod, count: rows.length, resident: sizes.reduce((a, b) => a + b, 0),
      top40: sizes.slice(0, 40).reduce((a, b) => a + b, 0) });
  }
} finally {
  const { pageScope } = await import('./src/engine/app/resources.ts');
  pageScope.dispose(); environment.dispose();
}
```

Remaining proof: complete combined ground/static product; actual entry-pose L0/L1/far union and hash-deduplicated dependencies; product/cache growth; reconciled and disposed native owners; net >=100 MB; then admission, same-pin parity and physical-memory measurement. The estimate was sent to sp-x2 and copied to wildshard-new. Plan-State: unchanged.
