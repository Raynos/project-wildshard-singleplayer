# Pine Hollow: round 14, the look loop (PH-L1 / L4 / L8)

Driftwood's method (`art/driftwood-isle/round-4-remaster/README.md`) with photoreal targets, at three zones. Each zone
was shot from 9 angles in the real game, codex image_gen edited every capture into a photoreal target, the gaps were
listed per angle and merged into a TOP-10, this lane fixed what is in its scope, a LUT was fitted, and round 2 was shot
from the same cameras.

**Board for Jake:** `board.jpg`, "Pine Hollow look — round 2 vs targets". Per zone it shows one FP shot and one aerial as
BEFORE (round 1) | AFTER (round 2) | TARGET, then the ΔE00 table. Jake signs off per zone.

## Files

- `cameras.json`: the three anchors and their 27 cameras, resolved. `node scripts/pine-hollow-views.mjs
  --cameras=art/pine-hollow/round-14-look-loop/cameras.json --url=<a clean export>` re-shoots them.
  - **cabin**: P (−20, −50) facing the ranger's cabin (−14, −34). This is round 0's anchor; the cabin did not move.
  - **pond**: P (−60, 106) facing E over the water to (−100, 110). This is layout v2's W shore.
  - **oldgrowth**: P (158, 12) facing S through the stones' gap into the King's clearing (150, −30).
- The query pins the frame: `tod=0.4167&clock=1000000&weather=clear&bossGod=1`. FP shots 1–4 are phone tier, iPhone 16
  Pro, 390×844, HUD on. Shots 5–9 are desktop, 1600×900, no HUD. Animals within 24 m are parked for the FP shots,
  because the elites ignore `calm`.
- `<zone>/capture-r1-<n>-<id>.jpg`: round 1, HEAD `7fb39f2`, before this lane. There is no LUT; the grade and ground are
  the old ones.
- `<zone>/mockup-<n>-<id>.jpg`: the 27 codex targets. Each is an image_gen EDIT of its capture: same camera, layout and
  HUD, with photoreal lighting, materials, ground and atmosphere, and nothing new added. The FP targets came back as 2:3
  recompositions of the 390×844 frame. None was re-rolled.
- `<zone>/capture-r2-<n>-<id>.jpg`: round 2, the committed look with the LUT on. It is a clean `git archive` export of
  this lane's commits on top of HEAD.
- `r1-<zone>-sheet.jpg`: round 1's 9-angle sheets, each cell labelled with its calls and tris.
- `r2-<zone>-vs-target.jpg`: round 2 in game | target, all 9 angles.

## Gap lists (what the target has that the game lacked in round 1)

Tracks: **G** ground (L8), **C** colour / grade / air (L1, L4), **T** trees, **W** water, **R** rock / crags, **U** understory.

**The Hollow (cabin)**
1. FP front: the ground is flat grey-beige gravel; the target has warm brown needle litter, cones, dry grass and cowberry
   (G). The shadows are cool blue and the frame is milky and low-contrast (C).
2. FP left: a white mist band sits along the tree line at 10:00 (C). The target has bilberry / heather carpet under the
   pines (U) and warmer, lighter crowns (T).
3. FP right: the open floor is pale beige grass with no litter or shrubs (G, U). The target's sky is a deeper blue (C).
4. FP back: the far tree line is hazy and white (C). The target puts the trail in warm compacted soil (G).
5. TOP: 20 m square brightness blocks and bald beige patches (G, tiling). The crowns read near-black (T). The target's
   ground is olive-golden: grass and shrubs in the open, litter under the crowns.
6. DIAG front: the target has 2× the trunks in the glade (T, density). The ridge's granite shows no cliff structure (R).
7. DIAG left: the ground is uniform tan (G). The shadows are blue-grey (C).
8. DIAG right: the trails are grey (G). The target's crowns are sunlit green (T).
9. DIAG back: the target has a warmer sun and softer, lighter shade (C).

**Still pond (W shore)**
1. FP front: the water sits under a grey fog veil (C). The target has crisp reflections and a reedy shore (W, U).
2. FP left: the ridge face is flat grey (R). The target's trail is warm soil (G).
3. FP right: the path is grey-violet gravel (G). The target shows litter and shrubs past the path (U).
4. FP back: the understory is sparse grass (U). The target has a birch / pine edge with ferns (U).
5. TOP: **the pond reads as an inky black disc with a hard, jagged rim** (W). The target shows clear dark water, visible
   shallows, and the sky in it.
6. DIAG front: the pond is black and the far ridge haze is heavy (W, C).
7. DIAG left: white mist smears over the water (C). The pond is black (W).
8. DIAG right: the ground is uniform tan (G). The waterfall's sheet is flat white (W).
9. DIAG back: the pond is black (W). The shore has no bank vegetation (U).

**Old-growth + King's clearing**
1. FP front: the W road is a wide flat grey strip (G). The distance is washed out (C). The target has a mossy
   clearing floor and shrubs along the road (U).
2. FP left: ferns are sparse (U). Shaded ground is flat (G).
3. FP right: the target's floor is warmer and litter-covered (G).
4. FP back: the giant's base sits on bare dirt (G). The target puts ferns and moss at its foot (U).
5. TOP: the clearing is pale beige (G). The target's is golden-green grass.
6–9. DIAG: the crowns are near-black from above (T). The dense shade under the giants is darker than the target's (C / T).
   The clearing floor is bald (G).

## TOP-10, merged and ranked by visual impact

| # | Gap | Track | Round 2 |
|---|---|---|---|
| 1 | The forest floor is pale gravel instead of boreal litter (all 27 frames) | G, L8 | **Fixed.** Poly Haven `forrest_ground_03` pine-needle litter is the floor layer, on the boreal splat shader (canopy-warmed litter, dry grass / cowberry drifts in the open, feather-moss patches in the shade). |
| 2 | Milky, low-contrast, blue-cast frame; a white fog veil and midday mist; the shade too dark | C, L1 | **Fixed.** `ChunkDef.look` adds an S-curve 0.2 and vibrance 0.2, warmer shade, the volumetric veil × 0.5, distance fog × 0.55, ground mist × 0.25 under a high sun, and the sky's fill (IBL + hemisphere) × 1.3 by day. The PineDayNight presets are untouched. |
| 3 | Palette: the sky, foliage, ground and shadow colours | C, L4 | **Fixed.** A learned LUT (`public/assets/lut/pine-hollow.bin`). Over all 27 frames the worst region is 4.7; per zone, only the pond's trail is over (7.8). |
| 4 | Bald understory: no shrub carpet, few ferns in the old-growth | U, L8 | **Fixed.** Shrubs × 4, ferns × 1.5, and ferns fill the dense shade (`ChunkForest.understory`). |
| 5 | The Hollow's glade has half the target's trunks (with the Blender species set it reads as park land) | T | **Fixed** at the coordinator's request. `HOLLOW_GROVE` in `pineHollowLayout.ts`: density × 2.4 within 120 m of (0, −45), plus a second candidate grid there (`ChunkForest.infill`). The Hollow's trees within 100 m go from 178 to 405, 1386 → 1656 overall. Trails, pads, the zip cut and the noise's clearings stay open. Navmesh re-baked; walk 0 stuck. |
| 6 | Ground tiling: 20 m square blocks, a visible 3.6 m repeat | G, L8 | **Fixed.** A rotated second sampling mixed by a 9 m value noise, a rotated far sample, and smooth macro noise. |
| 7 | Grey-violet trails | G, L8 | **Fixed.** A warmer trail tint, then the LUT. |
| 8 | Crowns read near-black from above; unlit crown interiors | T | **Out of scope** (trees lane). The fill light and the LUT lift them part way. |
| 9 | The pond is an inky black disc from above, with a hard rim | W | **Out of scope** (PH-L9 water lane). Its Fresnel / bed tint at steep angles needs the shallows and the sky. |
| 10 | The ridge granite is flat grey, with no cliff structure or ledges | R | **Out of scope** (CRAGS lane; its granite kit landed in `1c08f82` during this round). Rock normal strength is × 1.4 here. |

## ΔE00 per region (palette-delta.py, `scripts/palette-regions/pine-hollow.json`, round 1 → nolut → round 2)

| region | Hollow | pond | old-growth | all 27 |
|---|---|---|---|---|
| sky | 15.6 → 16.1 → **5.3** | 13.8 → 11.9 → **2.3** | 11.9 → 10.0 → **1.3** | 14.8 → 14.3 → **4.2** |
| foliage | 4.2 → 4.1 → **3.6** | 5.2 → 3.8 → **1.9** | 5.5 → 5.2 → **3.5** | 4.9 → 4.4 → **3.1** |
| ground | 6.3 → 4.6 → **3.2** | 6.9 → 6.1 → **0.8** | 7.7 → 6.2 → **1.2** | 6.8 → 6.1 → **1.0** |
| ground shadow | 10.7 → 8.0 → **5.7** | 9.2 → 7.4 → **4.4** | 10.0 → 5.6 → **4.4** | 9.9 → 7.1 → **4.7** |
| rock | 3.5 → 3.8 → **4.6** | 3.9 → 4.8 → **4.5** | — | 3.2 → 3.8 → **2.7** |
| trail | 6.5 → 2.9 → **3.2** | 5.9 → 4.8 → **7.8** | — | 6.9 → 3.5 → **2.9** |

- Over all 27 frames every region is under 6; the worst is 4.7.
- Per zone, one region is over: **the pond's trail, 7.8**. It is the shore path in pond FP-right, only ~19 k pixels. It
  went darker and greyer once HEAD's render fix (`1305f2d`: AO and the volumetrics see the world's depth again) landed
  mid-round; a brighter trail tint did not move it. Its next step is a round-3 look at that path (wet bank? AO?). The
  Hollow's shade is 5.7, under its denser grove.
- The pond's rock moved because the CRAGS lane's granite landed mid-round.
- "nolut" is round 2 without the LUT: the ground, the grade and the air alone.

## Refit

1. Capture the loop with `--query=nolut`, using the same cameras.
2. Run `python3 scripts/fit-lut.py --shard pine-hollow <dir with mockup-<N>-*.jpg> '<dir>/nolut-{n}.jpg'`. N runs
   1–27: frames 1–9 are the cabin, 10–18 the pond, 19–27 the old-growth, each in the loop's order.
3. Check with `palette-delta.py --shard pine-hollow` against the round-2 captures.
