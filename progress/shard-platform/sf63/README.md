# SF63: each shard looks like itself inside the grid (E435)

**Jake picked B (G232).** Inside its cell a shard keeps its own sky, light model, fog and environment, and (still open)
its colour grade. These captures compared the old Debug row **Region look**, A (one grid look) against B (the region's own),
each beside SHARD SELECT (the shard alone) at the same pose. The boards read SHARD SELECT / grid A / grid B. The next commit
makes B the only path and deletes the row.

B was the only row where the grid looked like the shards. Nalati got its painted haze and mountains back, Pine its own sky
instead of a black-and-orange forest, and Driftwood its toon light and day clock. Its cost: Pine's own sky is about +25 MB of
GL inside its cell (G223's PMREM sky), and up to +57 programs per region. Still open in B: the colour grade (LUT, curve,
vibrance: Pine's is the known gap), Nalati's grass density and post chain, and Driftwood's cumulus ring.

| Shard | Board | Grid A | Grid B |
|---|---|---|---|
| Nalati | `nalati-inside-e.jpg`, `nalati-inside-w.jpg`, `nalati-entry-road-e.jpg` | Flat page light. The far range and mountains are washed out | Painted haze, the range and the dome read as standalone. Grass is sparser and yellower than standalone (grass density and time of day), and Nalati's own post chain is not carried (only its grade) |
| Driftwood | `driftwood-entry-w.jpg`, `driftwood-inside-w.jpg` | Toon materials under a grey page sky | Its own dome, toon bands and the day clock (`uCloudTime` and `uToonLift` driven every frame). Its cumulus ring is missing |
| Pine | `pine-entry-n.jpg`, `pine-forest-120-e.jpg` | Black and orange forest (no environment or fill) | Its own sky and environment: close to standalone |

Captures: real drive-ins (`drive.mjs`: a Developer-ON grid boot, a pose onto the road only, then held input into the
cell), and SHARD SELECT references at the same poses in shard-local metres (`../playtest-2-drivein/standalone.mjs`, which
now takes an optional feet height). All are iPhone 16 Pro portrait, muted, one browser through `scripts/browser-lane.sh`,
on a build of this commit's source over `1a73265df` (candidate `640547a98`). The Driftwood "inside" pose is x = 160 because the hover stops at the wreck there.

## What B does (`src/engine/render/regionLook.ts`)

| Part | Mechanism |
|---|---|
| Light model and fog (lane 1, `de404f35d`) | The level's `lighting` / `fog` installs run once in a sandbox. Their chunks are inlined only on the region's own materials, under a `\|look:<level>` program key |
| **Its own frame** (lane 2) | A look's chunks are written in its level's own world frame, but a grid region is drawn at its cell offset (Nalati's root is at x = 555). Inside the inlined region chunks, in the fragment stage, `cameraPosition` and `vFogWorldPos` now read relative to the region origin (`wsLookOrigin`). This was the cause of B's "fog too thick near the camera": Nalati's slab-edge haze starts 251 m from its centre, so every fragment in the cell was over 270 m out and got 95 % haze past 60 m. Page chunks inside the region's text, and the material's own lines, stay in the page frame |
| **Per-frame parts** (lane 2) | The look's sky dressing `build` runs inside the same sandbox: Nalati's cloud field is bound, and its cloud-shadow hook on the sun loop becomes a region override, leaving the page's sun loop as it was. While the player is in the cell, an entry-scoped system runs the dressing's `update` (Nalati's cloud drift: `fogCloudOff` moves every frame) and the look's `frame`. They are disposed on leave. Driftwood's clock already runs through G223's layered backdrop in B; its toon uniforms are the ones the region's materials bind |
| Its runtime | Nalati's weather and look updaters (fog density, tint) already run while entered (the regional runtime), so they drive its fog values |

## The checks

| Check | Result |
|---|---|
| Shader errors | 0 in all six drive-ins (three shards, A and B) |
| Page read-back | Lights, scene fog colour, environment intensity and all 30 shared look uniforms of a road material are identical on the road before entry and after driving back out: Nalati A / B, Pine A / B. Driftwood: not measured (the drive back is blocked at the wreck). Unit: the sandbox puts `ShaderChunk` and the fog-uniform list back exactly, and the per-frame parts stop with the region's scope (`test/engine/region-look.test.ts`) |
| Programs inside (A → B) | Nalati 187 → 216 (+29). Driftwood 114 → 171 (+57: 31 are `\|look:driftwood-isle`, the rest are its G223 sky). Pine 178 → 201 (+23: G223 sky only, since Pine's look has no light or fog chunks). The SF59 budget is ≤ 64 distinct programs per shard, so B is inside it |
| GL MB inside (A → B; GL byte census, `scripts/parity/glbytes.mjs` `__sc_gl`) | Nalati 301 → 306 (+4.5). Driftwood 210 → 216 (+6). Pine 236 → 262 (+25, its PMREM sky). The road is 124 MB before any cell in both rows |
| SHARD SELECT parity (`scripts/parity.mjs`, both tiers, no rebaseline) | This source against its parent export, same lane: program keys and program counts are identical, and the pose images differ by at most 0.06 / 255 mean (Driftwood phone and desktop, Nalati phone). The parent's run timed out on Nalati desktop (a 240 s page wait under machine load), so Pine is unpaired. Against the committed baselines both sides are red on the same stale fields (recent G226 / SF47 work), which is not this row's change |
| `scripts/test-facade-instancing.mjs` | PASS desktop / phone tier / iPhone desktop quality: 0 batches, 24,710 instances |

## Files

`drive.mjs` (now also records GL MB, the region look's live uniforms twice a second apart, look-keyed program counts and
the road read-back), `drive-<shard>-<shared|own>.json`, the boards above. `drive-nalati-base.json` is lane 1's before.
