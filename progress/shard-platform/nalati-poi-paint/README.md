# Nalati static POI paint

G465/G466/G468, one whole-module conversion. No look change is intended.

## Data path

Deleted runtime modules: `world/paint.ts` (301 lines) and
`models/signpost.ts` (106). Static painter/specimen assembly now runs in
`generators/`; `world/painted.ts` keeps prepared instance placement and
native floor queries. `world/modelView.ts` binds the original shared
materials. No new shared host or runtime directory is introduced.

The six smooth `geometryKit` exports stay for the frozen Nalati runtime.
Its yurt still calls `revolve`/`revolveUV`, its granite still calls
`mergeVerticesByPos`, and its painted models still call `pole`, `blob` and
`lathe`. Primary Nalati's authoring generator carries the same arithmetic;
no primary runtime caller reaches it. No frozen source or pins change.

The retained live calls perform placement and queries: `NalatiSet.instance`
and `moving` record GLB placements/bounds for generated animals and riders;
`flushInstances` adopts loaded GLBs. `placeMember` registers baked collider
rows and the floor callbacks. `cragLedgeFloor`, `leopardCaveFloor` and
`kurganEntranceFloor` answer arbitrary player `(x, z)` queries from exact
baked numeric profiles. None of these calls generates painted geometry.

| Former live caller | Complete reachable inputs | Prepared output |
|---|---|---|
| Shepherd body | Fixed seed `0x5e9d` | 7,848 vertices; 282,528 attribute bytes |
| Shepherd whip arm | Fixed seed `0x5e9e` | 780 vertices; 28,080 attribute bytes |
| Road lettering | Five recorded signposts, 16 labels, terrain-fitted anchors | 128 vertices, original Uint16 indices; 512 × 1,024 RGBA atlas |
| Explorer lettering | The catalogue's only signpost defaults; no variants | 24 vertices, original Uint16 indices; 512 × 192 RGBA atlas |

Geometry uses the existing exact geometry writer/reader, compressed per
shape in prepared `boot/poiPaint.json`. Atlas RGBA bytes are compressed
in `boot/signAtlases.json`, beside the existing boot specimen catalogue.
Each caller decodes fresh owned geometry/texture arrays; there is no
decoded template cache, runtime font rasterizer, painter or AO bake.
The Explorer can build both the shepherd and signpost before world entry.
Unknown sign boards refuse rather than displaying the default lettering.
The retained Mac/V8 geometry and native-font atlas bakes preserve their
canonical bytes; reading either data file is platform independent.

The original signpost model wrapper adopts its prepared lettering in
`models/catalogue.ts`; its existing one-call host allowance follows it.
The old `paint.ts` callback allowance is removed.

## Exact evidence

The vertex/index oracle was extracted from source parent `7419a09cf`,
including its original PaintKit and smooth primitive implementations.
`test/fixtures/nalati-poi-paint.json` records each attribute's exact hash,
index type/hash, bounds, and the two original atlas pixel hashes. The
focused test checks fresh ownership, shepherd material slots/arm placement,
and atlas pixels/sampling before world entry.

The atlas bake compared every pixel against the extracted parent canvas:
roads `b018e4811be40e345a1d5ba3214b7260ac238a51b033a06dd69421a95906a55e`;
specimen `0c435ae6a300984e3a6e4625434ffada340d45d519363d5bf353b31ff20aacb8`.
The bake pins Metal, matching the live parent's rasterizer; the default
headless rasterizer produces different text antialiasing. Both comparisons
have zero tolerance. Existing places, specimen and
landmark payloads remain unchanged.

## Validation

The final source-basis inventory uses parent `3e99f268b` and candidate
`77dcf151f`, both built as all-ten products in mirror `check3`, with the
restored generator-sharing rule. Nalati falls from 20,657 to 20,166:
**net -489 shard lines (nalati-grasslands -491, driftwood-isle +2)**.
Nalati loses 390 shard runtime lines and 101 smooth-export closure lines.
Driftwood gains the one-line `UP` and `_q` geometryKit helper charges after
Nalati stops reaching them. Its source is unchanged; every other shard's
count is unchanged. [inventory.json](inventory.json) records the pair.
The earlier capture pair's -606 count in `parity.json` predates the census
restoration and is superseded by this final measurement.

Root and layer types, typed lint, tooling paths, the model contract, the
fixed-mesh regeneration and the existing complete POI/specimen regeneration
all pass. Five focused/headless files pass 35 tests, including all 17
shard-headless cases. The headless proof builds all ten products.

The pinned candidate proof ran in build-mirror `check2`, and its exact
parent in `check3`. The core commands were `tsc --noEmit`,
`tsc -b tsconfig.layers.json`, `oxlint --type-aware` on changed sources,
`check-paths.mjs`, `check-models.mjs --quiet`, both paint bakers' `--check`,
and Vitest for `nalati-poi-paint`, `nalati-static-landmarks`,
`specimen-catalogue`, `nalati-kurgan-fabric` and `shard-headless`.
The capture command was `proof-nalati-look-parity.mjs --signpost
--paint-inventory`; its saved summaries pass the harness's `--compare`.

The exact-parent captures match on all 14 frames: the six reference poses
plus the signpost pose in each of phone and desktop tiers. Saved RGBA
arrays compare byte for byte. Draws, triangles, GPU bytes, linked programs,
shader sources, colliders and the live shepherd/road-sign geometry,
material slots and atlas bytes also match. [parity.json](parity.json)
retains both captures and the source counts. No look changed.

Chromium renderer plus GPU resident bytes, recorded before byte hashing:

| Tier / sample | Parent bytes | Candidate bytes | Change |
|---|---:|---:|---:|
| Phone / boot | 1,781,235,712 | 1,809,924,096 | +28,688,384 (+27.36 MiB) |
| Phone / final | 1,797,734,400 | 1,803,436,032 | +5,701,632 (+5.44 MiB) |
| Desktop / boot | 2,224,177,152 | 2,352,709,632 | +128,532,480 (+122.58 MiB) |
| Desktop / final | 2,174,713,856 | 2,184,282,112 | +9,568,256 (+9.12 MiB) |

These are single Chromium process RSS samples, not physical iOS memory.
The GPU census is identical: 229,192,952 bytes phone and 553,133,406 bytes
desktop. The source reduction is not a measured resident-memory saving.

The official map was baked from committed snapshot `4d87e44c3`, which
includes the manifest generator landing. Generation ran before the bake
and again afterward; the source and decoded pixel stamps still verify.
Final root/layer types, typed lint, paths, models, both geometry bake checks
and all 35 focused/headless cases pass on that integrated snapshot.
Map source: `b61d55e08992cb389193e67adfcc0042f97c70c0f3a945a46379279304927468`.
Map pixels: `4ebc71c9719a690290d961dd4646e72fe88ccdca0726cc2b40cb319d2bbd7eeb` (unchanged).
The final all-ten regeneration at `77dcf151f` also verifies both map
stamps. The official image and its refreshed stamp land together.
