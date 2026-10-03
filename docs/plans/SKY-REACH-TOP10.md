# Sky Reach: the top 10 levers to the mockups (E407)

**State:** `in progress` 2026-10-03: written by the lead from the zoom-out audit (Jake: "when in doubt, zoom out … go big or go home"); the sky-reach builder works it row by row in place of the council's small fixes; the council keeps scoring each batch (bar 7.0, ledger 4 as amended).

## Why the game sits at 6.6 when the mockups are the target (first principles)

Ten council rounds moved Sky Reach from 4.67 to 6.60. The last four rounds added about +0.1 each, and the same
coefficients flipped back and forth: the meadow glow three times, the glare twice. Tuning has run out. Put the five
mockups beside the game frames and the gap is **how the world was made**:

1. **The islands are pancakes.** The mockups' floating islands are organic: rounded rock masses with overhangs,
   heavy hanging roots and vine curtains, waterfalls, and lush tree canopies spilling over the edges. The game's are
   flat-topped mesas, extruded 12-gons with a grass cap and evenly spaced cone firs. Islands fill a third of every
   spawn-side frame, so this one shape difference costs every view.
2. **The trees and grass read as a kit.** The mockup meadow is green and varied: blade heights, daisies, grey
   lichened rocks. The game's is uniform tall straw. The mockup conifers are natural; the game's are identical cones.
3. **The hero objects are code-built.** The fan, the glove, the dais, the standing stones, the windmill set and the
   keeper are procedural or mesh-split. The mockups show modelled objects with material detail.
4. **The constant 20–25 % of every frame is wrong.** The fan viewmodel is big, bulky and sits on the right edge of
   every frame. In A, B and D the mockup fan is smaller and lower. Only C makes it the hero.
5. **There's little depth between the layers.** The mockups stack islands at many depths, with sunlit volumetric
   cumulus between them and haze that grows with distance. The game puts its clouds mostly in one painted sky.

So the levers are **real assets and layered depth, built once and global**, not more coefficients.

## The rules for this plan

- **One world.** Every change is global and holds up from every place a player stands, including the hero views,
  aerials and the clip. No per-view hacks, and ledger 5 still holds. The lead's rulings stand: A's cluster over the
  mill, and the sky band following mockups A and C.
- **Assets go through the `mockup-to-model` skill.** Use the mockup crop as the reference sheet. TRELLIS.2,
  Hunyuan3D-2 and Blender scripts are all allowed; pick the best result. Mockup and model sit side by side on a board.
- **Budgets.** The phone limits are 1.8 GB loading and 1.0 GB Explorer. gpuMB ceilings are ratchets, re-recorded at
  the measured value.
- **Engine needs go to wildshard-9** as an ENGINE REQUEST, and the lead builds them.
- **Commit after each row, and send 'ready for round N'.** The council scores each batch at the 7.0 bar.

## The top 10, in order of expected gain

| # | Lever | Views it moves | How (go big) |
|---|---|---|---|
| 1 | **Modelled floating islands.** | A, B, C, proposal B, D's distant isles | Generate 5–8 hero island meshes with Hunyuan3D-2 or TRELLIS.2 from crops of mockups A, C and D. Each is a rounded rock mass with overhangs and a tapering, rooted underside, with a vine and root curtain as alpha cards and a waterfall where the mockups show one. Clean them up in Blender and add LODs. They replace the extruded 12-gon isles; the layout stays (the cluster ruling). |
| 2 | **Real trees and a lush canopy.** | A, B, C, D | 3–4 conifer models and 2 broadleaf or bush models from the mockups' trees (`mockup-to-model`), placed in natural clumps of varied scale and spilling over island edges. They replace the cone firs everywhere. |
| 3 | **Rebuild the fan and hand.** | all five (~20–25 % of every frame) | One modelled war fan (angular iron guards, lacquered ribs, folded silk with the cloud pattern, a red tassel) and a layered glove with a bracer, from mockups C and A. One hold for every view, and smaller and lower than now. A's, B's and D's mockups show it modest in the corner. C's hero framing comes from the same model's swing or idle pose, if a real ordinary pose reaches it. |
| 4 | **A green, varied meadow.** | A, B, C, D | Three grass species of different heights, colour from green roots to warm tips, daisy and wildflower clusters, and grey lichened rocks scattered through. Generate the textures, place them by noise and slope. It replaces the uniform straw sward and the glow coefficients that kept flipping. |
| 5 | **Volumetric cumulus between the islands.** | A, C, proposal B, D | A layer of sunlit cloud impostors at several depths: pre-rendered volumetric clouds from Blender, lit from the sun's azimuth, on camera-facing cards with depth fade. They sit below and between the islands, as the mockups stack them. Add haze that grows with distance, so the layers separate. |
| 6 | **The windmill set and the spawn island.** | A, C, proposal B | Model the windmill on its stone outcrop with its waterfall and stone base, plus the rope-post bridge heads, from mockups A and C. The bridge stays as built. |
| 7 | **The crown arena as a carved set.** | D | A carved stone dais with steps and an inlaid compass, sculpted standing stones with cut spiral runes, scattered boulders, a few trees at the rim, and pennant cloth that moves in the wind. Everything modelled from mockup D. |
| 8 | **A hero Roc.** | D | A modelled eagle Roc from mockup D: separated feather layers, a white head, a slate-and-white wing split, and talons. Animate it with a soaring and banking flight (the engine bank exists) whose ordinary approach comes toward the player at the arena entrance. |
| 9 | **Golden-hour light with depth.** | all five | Self-shading on the new island masses (the mockups light them from behind: the camera-side faces fall into soft shade, the rims catch the sun), warm rim light on silhouettes, the existing sun rays, and aerial perspective. Set the exposure once, after rows 1–5. |
| 10 | **The keeper set and one shard grade.** | B, all five | Model the keeper (cloth layers, face, an open wave) and the carved lectern with its hanging lantern from mockup B. Then one shard LUT derived from the five mockups (histogram transfer), global and never per view, for their painterly warmth. |

## Order of work

Rows 1, 3 and 4 come first. They change the most pixels in the most views. Then rows 2 and 5, then rows 6–10.
After each row: commit, capture, send 'ready for round N'.

## Status

| # | Owner | State | Evidence |
|---|---|---|---|
| 1 | sky-reach | landed (first pass) | six Hunyuan3D-2 island models from mockup crops (`art/far-reach/round-25-isles/`, 12k tris, 0.3-0.38 MB each), the 20 sky isles and the 8 playable islands' keels (clipped under their decks); the cluster crags a fifth smaller so they read as masses, not a wall; board-cluster.jpg |
| 2 | sky-reach | landed (first pass) | five Hunyuan3D-2 trees from the mockups' trees (`art/far-reach/round-26-trees/`: tall, wide and young pines, an oak, a bush; 6k tris, 130-187 KB each) on every tree spot by a seeded share, own yaw, scale and lean, bark pulled to brown (world/trees.ts); the card firs stay the fallback |
| 3 | sky-reach (fan subagent) | done 2026-10-03, `a9454b567` | Chamfered angular guards, pierced plates, deeper pleats, new cloud-silk leaf, the tassel plumb from the pivot; a layered Hunyuan glove with a lamellar bracer. One hold for all views; measured (exact projected mask, 390x844): left 171→201, top ~456→~480, share 7.8→6.6 %; IoU with the mockups' fans C 0.33→0.45, A 0.35→0.67, B 0.22→0.46, proposal B 0.48→0.53. C's 13.6 % hero framing is reached by no ordinary pose, so the modest hold stays. Board: `art/far-reach/round-23-fan-glove/` |
| 4 | sky-reach (meadow subagent) | built e0e4b837c | Three grasses placed by noise and slope, green roots to warm tips, and one through-light term (the glowNear split is gone). Also the mipped-atlas coverage fix, daisy drifts and 41 lichened meadow rocks. Seats' patches, mockup / before / after: A L 40/61/105 / 45/63/90 / 32/57/107, hp 12.4 / 10.4 / 16.3; B spread 72 / 49 / 78; pB spread 63 / 39 / 72; near ground A 61/63/57, C 67/78/76, D 56/85/59. Board: art/far-reach/round-24-meadow/. Left: C's patch is bright, the mid-field tufts are patchy, blue is short. |
| 5 | sky-reach | landed (painted banks) | 48 seeded cumulus banks between and beyond the sky isles in the shard's painted cumulus (look/render.ts cloudBanks), clear of the rock, the playable islands and the sun disc; Cycles-volume cumulus were tried and dropped (CG cotton against the painterly sky; `art/far-reach/round-30-cumulus/volumetric/`); top 1 % A / C / proposal B 238.9 / 239.0 / 239.5 (mockups 238.4 / 235.7 / 238.8) |
| 6 | sky-reach | open | |
| 7 | sky-reach | landed (first pass) | two Hunyuan3D-2 standing stones with cut spiral runes and a carved compass dais from mockup D (`art/far-reach/round-28-crown/`, 8k tris each) in place of the code set (world/crown.ts carvedSet); colliders unchanged; board-d.jpg |
| 8 | sky-reach | landed (first pass) | a Hunyuan3D-2 eagle from mockup D's (`art/far-reach/round-27-roc/`: white head, hooked beak, slate-and-white layered wings, talons forward; 12k tris, 1024 WebP) as roc-hd, pitched head-up as the mockup flies it, span 16 m; the auto-rig flaps it; its take-off toward the entrance (round 10) and its perch reset on a retry (round 12) kept; board-d.jpg |
| 9 | sky-reach | open | |
| 10 | sky-reach | open: the first LUT fit is out | the fit (`art/far-reach/round-29-lut/`) never ran in round 13 (the export lacked the file); measured live it greyed C's sky (175/156/156 vs the mockup's 202/168/148) and pushed C's and D's near ground (114 / 113 vs 95 / 107) and A's and C's top 1 % (246.6 vs 238 / 236) past the mockups, so it is out of the build (look/render.ts lut null) until a refit that keeps C's sky warm; the keeper set is open |
