# Pine Hollow: round 17, the look loop's round 3 (PH-L1 / L4 / L8)

This is round 14's method (`art/pine-hollow/round-14-look-loop/README.md`) at the other three zones, the ridge, the den
and the hamlet. It also fixes round 2's one miss, the pond's shore trail (ΔE00 7.8). The LUT is refitted over all six
zones' 54 frames.

**Board for Jake:** `board.jpg`, "Pine Hollow look — round 3 vs targets". Each of the six zones shows one FP shot and one
aerial as BEFORE | AFTER | TARGET, then the ΔE00 table. Jake signs off per zone.

## Files

- `cameras.json`: the three new anchors and their 27 cameras.
  - **ridge**: round 0's anchor, (100, 131) facing the ridge cabin (118, 142) under the crags.
  - **den**: (170, 165) facing NW to the den floor (190, 186). This is layout v2's fix.
  - **hamlet**: the S road spur's end, (−118, −134), facing E over the lodge, trader and mill.
  - The query is round 14's: `tod=0.4167&clock=1000000&weather=clear&bossGod=1`.
- `<zone>/capture-r1-<n>-<id>.jpg`: before, a clean export of the merged HEAD `fddbda7` with round 2's look.
- `<zone>/mockup-<n>-<id>.jpg`: 27 codex photoreal targets. Each is an image_gen EDIT of its capture, with the same camera,
  layout and HUD. None was re-rolled.
- `<zone>/capture-r3-<n>-<id>.jpg`: after, a clean export of this round's commit, LUT on.
- `r3-<zone>-vs-target.jpg`: every one of the 6 zones, all 9 angles, in game | target. The Hollow, pond and old-growth
  targets are round 14's.

## Gap lists (what the targets have that round 2's game lacked)

Tracks: **G** ground (L8), **C** colour / grade (L1, L4), **T** trees, **R** rock / crags, **U** understory, **M** models.

**The Ridge**
1. FP front: the open floor is a flat, even tan with bright lime grass tufts in a lawn-like grid (G, U). The target has
   dry golden-olive grass, bilberry / heather mats and needle litter, mottled.
2. FP left: the W road reads as a grey band (G). The target puts litter at its edges.
3. FP right: the floor is the same flat tan (G). The target's floor is darker, with shade-dappled heath.
4. FP back: the grass is lime (U).
5. TOP: the crag rock is darker and blotchier than the target's pale granite (R); the terrain's rock layer is dark too
   (G). The open floor is uniform tan (G).
6. DIAG front / 7 left / 8 right / 9 back: the crag faces are stretched, with no ledges (R). The crowns read near-black (T).
   The target's floor is olive with heath.

**The Den**
1. FP front: the slope is bright tan with lime grass (G, U). The target shows litter, heath and ferns on a darker slope.
2. FP left: the ground under the pines is pale (G). The target has litter and a fern understory (U).
3. FP right: the target's rock wall has lichen and fractures (R). Its slope is litter and heath (G).
4. FP back: the den trail is dark red-brown (G). The target's is dusty soil.
5. TOP and DIAG: **the crag meshes' textures stretch across big faces**; DIAG right is the worst, where the camera is
   next to a crag (R). The target has real fractured granite with lichen.

**The mill hamlet**
1. FP front: the wide trail is red-brown mud (G). The target's is dusty soil with litter at the edges.
2. FP left / 3 right / 4 back: the open floor is a uniform tan lawn with lime tufts (G, U). The target has heath, grass
   and litter mixed, darker in shade.
5. TOP / DIAG: the ground is uniform tan (G). The target's is olive and golden with heath patches. The crowns read dark (T).

**The pond (round 2's miss)**
- FP right: the pond spur trail, which P stands on, is an 11 m band of grey-violet gravel (G). The target's is dusty
  soil, with litter and dry grass eating into its edges.

## TOP-10, merged and ranked by visual impact

| # | Gap | Track | Round 3 |
|---|---|---|---|
| 1 | The open floor is a flat tan lawn (all three zones, every frame) | G, L8 | **Fixed.** The boreal shader adds heath: darker olive bilberry / heather mats in ~1.5 m noise patches over the open floor and the grass. The open drift is olive, not tan. |
| 2 | Lime grass tufts | U | **Fixed.** `boreal.grassTint` × (0.8, 0.74, 0.55) on every tuft (`Grass.ts`): dry golden-olive. `?ground=v1` restores the old colour. |
| 3 | Sparse understory on open ground | U, L8 | **Fixed.** Shrubs × 12 (18 000; round 2 had × 4), still one draw. |
| 4 | Trails: red-brown mud or grey-violet gravel in clean wide bands | G, L8 | **Fixed.** `boreal.trailDust` pulls the path set toward a dry, warm soil, the tint is brighter, and a noise erodes the verges so the litter eats into their edges. |
| 5 | The pond's bank is a gravel apron | G | **Fixed.** The pond's shore band of the trail layer is narrowed (pondMask 0.35–0.6 → 0.62–0.88), and the slope scree on the pond's dish is cut to 15 %. |
| 6 | The terrain's rock layer is dark | G | **Fixed.** The rock tint goes 0.85 → (1.0, 0.98, 0.94). |
| 7 | Palette per zone; the sky darker than the targets' | C, L1, L4 | **Refitted.** The LUT is fitted over all 54 frames (six zones): `greyAnchor` 1 (the fit's grey-axis identity weight, a new optional key; Driftwood keeps 3) lets it move the greys, and sky / rock / trail are weighted 1.5. The look adds `sky` 1.18, the dome × 1.18 by day (the IBL follows it), and the fill goes back to 1.3. |
| 8 | Crag textures stretched over big faces; dark, blotchy granite; no ledges | R | **Out of scope** (CRAGS lane). This is the ridge's rock ΔE; see below. |
| 9 | Crowns near-black from above | T | **Out of scope** (trees lane). |
| 10 | The den's grass slope has no litter under its sparse pines | G | Partly fixed by #1 / #3. The rest is the canopy map (sparse trees = open floor). |

## ΔE00 (palette-delta.py, `scripts/palette-regions/pine-hollow.json` over 54 frames; round 2 → round 3, in game, LUT on)

"Round 2" here means the merged HEAD `fddbda7`'s look: round-14's captures for the first three zones, this round's
`capture-r1` for the new three.

| region | Hollow | pond | old-growth | ridge | den | hamlet | all 54 |
|---|---|---|---|---|---|---|---|
| sky | 5.3 → **4.6** | 2.3 → **1.1** | 1.3 → **2.0** | 7.7 → **6.7** | 7.0 → **7.0** | 6.2 → **3.9** | 5.8 → **4.7** |
| foliage | 3.6 → **3.5** | 1.9 → **1.8** | 3.5 → **3.6** | 2.1 → **2.1** | 3.3 → **2.7** | 3.7 → **3.3** | 2.8 → **2.6** |
| ground | 3.2 → **4.5** | 0.8 → **1.7** | 1.2 → **2.9** | 2.7 → **3.5** | 2.1 → **3.1** | 2.5 → **2.6** | 1.5 → **2.6** |
| ground shadow | 5.7 → **5.9** | 4.4 → **4.8** | 4.4 → **4.9** | 4.7 → **4.3** | 4.5 → **3.8** | 4.7 → **3.5** | 4.3 → **4.1** |
| rock | 4.6 → **6.2** | 4.5 → **3.2** | — | 10.5 → **8.8** | 1.4 → **2.7** | — | 3.1 → **1.7** |
| trail | 3.2 → **3.8** | 7.8 → **4.9** | — | 3.0 → **3.1** | — | 2.4 → **5.3** | 1.2 → **2.0** |

- Over all 54 frames every region is under 6; the worst is 4.7.
- Round 2's miss, **the pond's trail, is fixed: 7.8 → 4.9.**
- Per zone, four regions are still over 6:
  - **Ridge rock, 8.8.** These are the crag meshes (the CRAGS lane's granite kit): darker and blotchier than the targets'
    pale granite, with stretched faces.
  - **Ridge sky 6.7, den sky 7.0.** At these two zones codex painted a paler zenith than at the other four. The game's sky
    is the same dome everywhere; the pooled sky is 4.7.
  - **Hollow rock, 6.2.** This is the far ridge granite, now a shade brighter than its target.

## Rulers (clean exports, HEAD `a9eac35` vs this round)

- Phone calls ≤ 155 at every pose (gate 107 → 107, cabin 156 → 155, den 106 → 109), tris +0.01 M.
- Desktop ≤ 268.
- Programs 105 / 113 before and after, with none added walking. Driftwood's are 97 / 106 with the same program-source sha
  before and after (`ff2569021969` / `248e2e6c31ad`).
- 30 fps (4× CPU, a quiet machine, load average ~2):
  - HEAD, with the denser Hollow: 100 % of intervals at 33.3 ms at all 6 poses; work p95 10.6–13.5 ms.
  - This round: 100 %; work p95 10.9–12.8 ms.
  - The files are `progress/pine-hollow-fps-lookloop-r3-4311.json` (HEAD) and `-4313.json` (this round).
- tsc and vitest 509 pass on the exported tree.
