# Pine Hollow and Driftwood Isle: where the memory goes (SF46 / SF47 breakdown, 2026-10-04)

**2026-10-08 correction (G188/SF67).** The measurements below remain evidence for `6844a302a`. Its images-first Auto description is historical: a measured over-cap phone estimate now selects KTX2 on the first visit. Texture choice and cache warmth are separate axes; do not treat these explicit `img` rows as the current cold Auto default. Category caps quoted below are historical targets; the current hard limits are complete 1,000 MB playing / 1,800 MB loading totals.

Rows SF46 and SF47 of [SHARD-PLATFORM](../../../../plans/SHARD-PLATFORM.md), against §3.2's caps v1 (shard library ≤ 25 MB,
L0 tile ≤ 4 MB, L1 ≤ 2 MB, far 1.6 MB, sim ≤ 25 MB, no JS copies after upload, shadows only within ~80 m). It follows
[SF22a](sf22a-memory.md) (Simulator: Pine Hollow 1,097 MB alone, Driftwood 868 MB). Raw numbers:
[`progress/memory/pine-driftwood-census.json`](../../../../../progress/memory/pine-driftwood-census.json). Build `6844a302a`
(a clean HEAD export). Decimal MB.

**How it was measured.** SF22b's labelled GL census (`scripts/parity/glbytes.mjs`'s `GL_INIT`, the engine's
`gpuLabels.ts` labels) in desktop Chromium on Metal, iPhone 16 Pro context, phone tier, render scale 2, muted, through
`scripts/browser-lane.sh`. A scratch probe (not committed) adds three things to `glbytes-probe.mjs`: (1) after visiting
every capture pose and two forced GCs, every labelled CPU source (geometry array, decoded bitmap, canvas, KTX2 mip) that is
still alive, found by weak reference, so the JS column is what really stays, not what the scene points at; (2) the
renderer and GPU process `phys_footprint`, V8 heap and ArrayBuffer bytes (CDP); (3) in-page **drop experiments**: release
the CPU copies of what has already been drawn, run 120 frames, GC, measure again, then walk the poses again to see if
anything breaks. Every shard was read in both texture modes:

- **KTX2** (Settings ▸ Debug ▸ GPU textures `ktx2`): the phone's steady state once the shard's KTX2 set is cached. **The
  tables below use this mode** unless they say otherwise.
- **img**: a cold first boot (Auto picks `img` until the set is cached): Pine Hollow's GL bytes are 660 MB here, not 360.

Every census reconciled (listed bytes = the GL total) with 0 unlabelled resources (Pine 1,319 resources, Driftwood
1,444). Desktop is not the phone: GL bytes carry over (ASTC is used on both: Metal Chromium exposes ASTC), process sizes do
not. Use the savings as deltas.

## The totals

| | Pine Hollow (KTX2) | Pine Hollow (img, cold) | Driftwood (KTX2) | Driftwood (img) |
|---|---|---|---|---|
| **GL bytes** | **360.3** | 659.8 | **318.5** | 341.1 |
| textures | 231.0 (of which uncompressed RGBA8 103.6, RGBA16F 38.5, ASTC 88.4) | 530.6 (all uncompressed) | 45.1 | 67.7 |
| geometry buffers (+ instance data) | 48.0 + 3.2 | 48.0 + 3.2 | **172.9** + 8.7 | same |
| render targets: post / screen (engine) | 47.2 | 47.2 | 38.6 | 38.6 |
| render targets: shadow maps | 8.4 (one 1024², with a colour texture) | 8.4 | **41.9** (five 2048² depth) | 41.9 |
| render targets: PMREM environment | 22.0 (three 256 cube-UV + depth) | 22.0 | 11.2 | 11.2 |
| **CPU copies still alive after upload** (post-GC) | arrays 91.4, bitmaps 41.9, canvases 31.7 | arrays 87.4, **bitmaps 243.5**, canvases 31.7, images 9.0 | **arrays 204.4**, bitmaps 25.2 | arrays 202.8, bitmaps 29.9, images 22.0 |
| scene geometry arrays (SF22a's column) | 73.4 | 73.4 | **201.1** | 201.1 |
| renderer process / V8 heap / ArrayBuffers | 1,084 / 94 / 165 | 1,068 / 95 / 160 | 698 / 49 / 237 | 675 / 49 / 235 |
| draws / triangles (spawn) | 93 / 0.96 M | | 205 / 1.04 M | |

The shard's own cost is GL minus the engine's screen targets (post 47 MB / 39 MB are engine base, §3.2's 300 MB): Pine
~313 MB, Driftwood ~280 MB. Against a 25 MB library plus tiles, both are an order of magnitude over.

## Pine Hollow: the breakdown (KTX2)

**Textures (231 MB)**

| Item | MB | Format | Note |
|---|---|---|---|
| HDRI sky blend `tA` + `tB` (qwantani late afternoon / mid morning, key.jpg + gain.png) | 33.6 | 2 × 2048×1024 RGBA16F | decoded gain map, uncompressed half float |
| Training dummies (`practice/dummies/{straw-cloth,wood-steel,wood-wood}.glb`, map + roughness) | 33.6 | 6 × 1024² RGBA8 | engine practice ring, loaded in every shard; GLB-embedded PNG, not KTX2 |
| Creature rigs (antler-king, boar, deer ×2, elk ×2, bears ×2) | 19.6 | 512² RGBA8 | `*.phone.rigged.glb`, embedded PNG |
| Skinned mesh maps (NPC / wildlife variants, `SkinnedMesh[0–5]`) | 15.8 | 512² RGBA8 | |
| Other uncompressed: ground decal / pond sets (`Group/Mesh[1–3]` map + normal + AO), fern 2.8, needle litter, bilberry, animals 4.2 | ~30.7 | RGBA8 | runtime-built materials |
| Terrain PBR arrays (forest ground, leafy grass, rock ground, stony path: diffuse + normal + ARM) | 11.9 | ASTC, 1024²×4 | the ground material |
| Bark arrays (pine, fir, metasequoia, birch, willow) | 4.4 | ASTC, 512²×5 | |
| Poly Haven props (hatchet, fire pit, barrel, bucket, crate, lantern, fallen log, stump, mossy boulder) | 27.0 | ASTC, 1024² + 512² ARM, 3 MB each | |
| Building sets (rock ground ×2 copies, wood planks ×2, mossy rock, stone wall, door, trunk wall, pine bark) | 22.4 | ASTC 1024² | rock ground is uploaded twice (one `Texture` per `repeat`) |
| Hero parts, NPCs, tree cards / impostors, horizon bands, planet | ~11 | ASTC | |

**Geometry (51 MB GPU; 91 MB of arrays still in JS)**

| Item | GPU MB | Note |
|---|---|---|
| Cabin cluster (`Scene/Group[19]`) | 11.5 | 47 meshes in one place: ~3 × an L0 tile's 4 MB |
| Animals, of which `herd-shadow` skinned shadow copies | 7.9 | + 12.8 MB arrays in JS |
| Ridge crag (`cragCliff.ts`) | 6.0 | |
| Terrain (`Group/Mesh[0]`: index 1.6, splat 1.1, position / normal / uv) | 5.2 | a tile item |
| Forest trees (batched) | 3.6 | |
| Everything else (lookout, ferns, litter, footbridge, hero GLB parts, NPC rigs) | ~17 | |

**Render targets (77.6 MB)**: composer buffers 2 × 8.8 (RGBA16F 804×1362) + 2 depth 4.4 each, `LuminancePass` 8.8 at
full resolution, SMAA edges + weights 8.8, bloom mips 3.6 (all engine base); **PMREM: three 768×1024 RGBA16F cube-UV
targets 18.9 + depth 3.2** (Pine's stepped day/night environment keeps two cubes and its generator; one is probably
`DummyStudio`'s `fromScene` at the default size, unverified); env equirect 1024×512 RGBA16F 4.2; **shadow map 1024²: depth
4.2 + an RGBA8 colour texture 4.2** that Driftwood's shadow path deletes (`dropColour`, E174) and Pine's does not.

## Driftwood Isle: the breakdown (KTX2)

**Geometry (182 MB GPU; 204 MB of arrays still in JS)**

| Item | GPU MB | JS MB | Note |
|---|---|---|---|
| **Blender island** (`BlenderIsland.ts`): ~60 prototypes **merged as copies** into tiles | **103.7** | 116.3 | cover-big 41.3, cover 21.7, casters far copy 20.8, casters 19.5 |
| · by attribute | | | normal 29.8 (used only for the shadow normal bias: shading is flat), position 29.7, aBase 14.5 (Float32 per vertex), index 10.0 (Uint32), colour 9.9, aEdge 4.8, aGround 4.8 |
| Ground cover (`Scene/ground-cover`) | 11.9 | 11.9 | merged |
| Prop models drawn merged: palms 8.5, hibiscus 8.3, shore boulders 6.5, small rocks 4.5, trailside 2.8, shrine 2.5, cove 2.3 | 35.4 | 35.4 | `place(…, draw: 'merged')` |
| Instance data | 8.7 | 14.1 | |
| Seabed, wreck rocks, pier / jetties, lookout, hut, terrain tiles | ~22 | | |

**Textures (45 MB)**: training dummies 33.6 (RGBA8, the same three GLBs), horizon day / night 2 × 2.8 (ASTC 4096×512;
11.2 each uncompressed on a cold boot), baked AO / bounce lightmaps 1.75, LUT and sprites ~3.

**Render targets (91.7 MB)**: **shadow maps 41.9 = five 2048² DEPTH16**: three CSM cascades + two `sun-shadow-fade` ghost
lights (`src/engine/world/shadowFade.ts`, which cross-fade a sun step); composer 2 × 8.8 + 2 depth renderbuffers 4.4 each,
luminance 8.8, bloom mips 3.6 (engine base); PMREM 768×1024 6.3 + depth 3.2 (not Driftwood's own env, which is size 64:
two 336×256 = 1.4).

## Drop experiments (measured in the page, not committed)

| Experiment | Pine Hollow | Driftwood |
|---|---|---|
| KTX2: release every drawn static geometry array except `position` (index too) — what `gpuOnlyAttributes` does by default | 13.8 MB released; ArrayBuffers −12.6, renderer −83 (noisy) | **82.4 MB released; ArrayBuffers −82.4, renderer −93**; the re-walk is clean |
| KTX2: release every drawn static array (position and index too) and every texture source | 26.4 + 58.0 MB released; ArrayBuffers −42.5, **renderer −155** | 138.0 + 25.3 MB; ArrayBuffers −138, **renderer −166**, **but the re-walk stalls** (something reads positions / indices after upload: find it before a full drop) |
| img (cold boot): release texture sources only | **260 MB of decoded bitmaps; renderer −254** | 47.7 MB; renderer −28 |
| img: release every drawn static array | 42.9 MB; ArrayBuffers −41, renderer −37 | 138 MB; ArrayBuffers −138, renderer −152 (same stall) |
| KTX2: terminate the transcoder workers | 0 (renderer unchanged) | 0 |

The texture sources still alive in KTX2 mode (58 MB on Pine) are the GLB-embedded PNGs (dummies, creature rigs), canvases
(trophy wall 7.9, animal maps, fern / litter atlases) and the mips of KTX2 clones that never uploaded
(`releaseAfterUpload` fires on upload only). Only Nine Dragon calls `gpuOnlyTexture` / `gpuOnlyAttributes` today; the img
path's `loadImage` cache keeps every decoded bitmap for the page's life.

## Pine Hollow: the cuts, by MB saved

GPU = GL bytes; CPU = renderer process. Measured (M) or computed from the census sizes (C) or estimated (E).

| # | Cut | GPU MB | CPU MB | How known | Look | Effort |
|---|---|---|---|---|---|---|
| 1 | **Release CPU sources after upload** (`gpuOnlyTexture` in `loadTexture` / GLB / rig / canvas paths and evict `loadImage`'s cache; `gpuOnlyAttributes` on static meshes; free never-uploaded KTX2 clone mips) | — | **−155** (KTX2) · **−254** cold boot | M | none | S–M |
| 2 | **Training dummies load at the practice ring, not at boot** (or KTX2 them: −25) | **−33.6** | −31 (bitmaps 25 + arrays 6; part of #1's figure) | C | none | S |
| 3 | **HDRI sky blend from 8-bit**: keep the key (ASTC) + gain (R8) and decode in the shader instead of two RGBA16F 2048×1024 | **−29** | — | C | none | M |
| 4 | **Rig textures to KTX2** (creatures 19.6 + skinned variants 15.8) | **−26.5** | — | C | none | S |
| 5 | **Runtime-built textures to ASTC** (ground decal / pond sets, fern / litter / shrub atlases, animal maps; ~30.7 RGBA8) | −23 | — | C | none | M |
| 6 | **PMREM at cube size 128** (three 256 targets today; or keep one cube: −6.3) | −16.5 | — | C | small | S |
| 7 | **`herd-shadow` copies**: cast from the visible herd LOD (or a blob) instead of skinned shadow-only meshes | −7.9 | −12.8 | C | small | M |
| 8 | **Shadow map's colour texture** deleted as Driftwood's path does (E174) | −4.2 | — | C | none | S |
| 9 | **Duplicate uploads**: one GL texture per file, not per `repeat` (rock ground) | −2.8 (−22 cold boot) | — | C | none | S |
| 10 | Engine base, every shard: `LuminancePass` at half resolution −6.6, one composer depth −4.4 | (−11) | — | C | none | S |
| — | *Visible tier*: ASTC 6×6 for the 88 MB of ASTC 4×4 sets | −49 | — | C | small–visible | S (bake) |
| — | *Visible tier*: props and building sets at 512² | ~−30 | — | E | visible up close | S (bake) |

**Without a look change: ~119 MB of GL (#2–5, 8, 9) and ~155 MB of renderer (#1, measured), ≈ 275 MB of the phone
footprint.** Pine's textures would fall from 231 to ~115 MB. That is still four times a 25 MB library. **SF47-g needs the
visible tier too**: ASTC 6×6 everywhere (→ ~50 MB) plus 512² props / building sets (→ ~25–30 MB), and the last few MB
come from fewer unique PBR sets (a dozen-plus Poly Haven sets and nine textured props today). That is Jake's pick, as a Debug variant sheet (photoreal
PBR is Pine's look). Geometry already fits the tile model in total (51 MB across the cell) except two hotspots: the cabin
cluster (11.5 MB in one place, ~3 × the L0 cap) and the ridge crag (6 MB), which need LOD or instancing to split into
4 MB tiles.

## Driftwood Isle: the cuts, by MB saved

| # | Cut | GPU MB | CPU MB | How known | Look | Effort |
|---|---|---|---|---|---|---|
| 1 | **Instance the Blender island's prototypes** instead of merging copies (per-instance tint / AO / edge / base as instance attributes) | **~−95** of 103.7 | ~−110 of 116 (overlaps #2) | E | none | L |
| 2 | **Release geometry arrays after upload** (`gpuOnlyAttributes`, keep `position`; the full drop needs the position / index reader found first) | — | **−93** (−82.4 ArrayBuffers) · full −166 | M | none | S (keep) / M (full) |
| 3 | **Shadows within ~80 m** (§3.2): two 2048² cascades, no fade ghosts (−25); or all five at 1024² (−31.5) | **−25** | — | C | small (a sun step pops; no shadows past ~80 m) | S |
| 4 | **Training dummies at the practice ring** (+ the 256 PMREM if it is `DummyStudio`'s: −9.4, unverified) | **−33.6** | −31 | C | none | S |
| 5 | **Prop models placed instanced, not merged** (palms, hibiscus, boulders, small rocks, trailside, shrine, cove) | ~−28 of 35.4 | ~−28 | E | none | M |
| 6 | **Quantise the island's merged attributes** if #1 is not done: normal → Int8 (−22.3), aBase → Float16 (−7.2) | −29.5 | (−29.5) | C | none | M |
| 7 | **Ground cover instanced** | ~−9 of 11.9 | ~−9 | E | none | M |
| 8 | **Other normals → Int8** (flat shading reads them only for the shadow bias) | −8.5 | — | C | none | S |
| 9 | Horizon bands: cold boot only (2 × 11.2 RGBA8 until the KTX2 set is cached) | (−17 cold) | — | C | none | — |
| 10 | Engine base (as Pine #10) | (−11) | — | C | none | S |

**Without a look change: ~166 MB of GL (#1, 4, 5, 7) and ~93–166 MB of renderer (#2), ≈ 260–330 MB.** After #1, #4, #5
and #7, Driftwood's library is the ~60 island prototypes + the prop models + ~12 MB of textures, **an estimated 20–30 MB:
at the cap.** The island's tiles then hold instance lists (a few hundred KB each), well inside L0's 4 MB. Shadows (#3) are the
one item with a look cost, and §3.2 already rules "shadows only within ~80 m": SF46-g can take it as the format rule.

## What this says for SF46-g / SF47-g

- **Driftwood is reachable without a look change** (instancing + no JS copies + dummies lazy), with shadows cut to the
  §3.2 rule. Order: #2 (S, −93 MB, measured) → #4 (S) → #1 (L, the big GPU item) → #5, #7.
- **Pine is not reachable without a visible change.** The no-look cuts (#1–5, 8, 9) take ~275 MB off the phone and should
  ship first (default-off Debug rows per RENDERING.md); the library still needs ASTC 6×6 and 512² sets, which go to Jake
  as a variant sheet.
- **Both shards**: the engine's practice dummies cost 33.6 MB of GPU and ~31 MB of CPU in every shard that boots them.
- **Open**: the renderer process holds memory this census cannot see: Pine ~1,084 MB = engine renderer floor (~208, SF22a
  template) + V8 94 + ArrayBuffers 165 + WASM 14 + labelled bitmaps / canvases 74 + **~530 MB unattributed** (Driftwood
  ~170). It is not GL objects, V8 heap, ArrayBuffers or the transcoder workers; `vmmap` puts it in two anonymous VM tags
  (253, 255) and cannot open Chromium's PartitionAlloc zones. The Simulator's WebContent for Pine is 700 MB (SF22a), so part
  of it is Chromium-specific; the next step is a WebKit reading of the same cuts (`scripts/sim-memory.mjs`), not more
  desktop work.
