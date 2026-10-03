# Round 7, seat C (Claude, red team: the demanding art director), Signal Dunes

Surface: `art/mockup-council/round-7/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0156-eeee0e02/` (every `mock-*`, the four hero views, both aerials,
`clip.mp4` sampled at 0.5 fps). For before and after: round 6's `20261003-0132-28e3eb78/` and round 5's
`20261003-0057-56c23085/`, and the five ledger mockups at full resolution scaled to 780×1688. I built quadtychs
(mockup | r5 | r6 | r7) region by region: the dune band, the sky, the near sand, the coil and glove at 1×, the brazier at
0.8×, C's right horizon, and the wagon at 2×. Source check: the shard commits between the captures (`b3beecc14`,
`c691d95f2`, `19e78bf2e`; the last touches `render.ts`, `dusk.ts`, `sky.ts`, `layout.ts`, `dunes.ts`, `meshes.ts`,
`places.ts` and the re-baked terrain and navmesh). All brightness is Rec. 709 luma. Sand is measured on this seat's
clean patch, clear of the coil, Sefa and the HUD: **x 10–240, y 1150–1450**. Fine detail is mean |luma − Gaussian-blurred
luma| (σ 2 px). Regions are fractions of the portrait frame (x left → right, y top → bottom).

**The short version.** Round 7 is mostly round 5 again. The terrain, camera heights and late-dusk light are back to
round 5. D's sky column and ground are round 5's to the unit (column luma at y 0.25–0.60: 36 39 42 64 75 85 99 122 104
45 in both). Three things changed on top of that:
- the coil is dark again, but it now reads as a checkerboard tape, not a plait;
- the grain sits between round 5 and round 6;
- C has one log stub above the rim, and its next waymark is visible again.

Round 6's real regressions are undone. Round 5's open defects are all back with them.

## The measurements (mockup / r5 / r6 / r7)

| View | Clean sand luma (p50) | Spread p5–p95 | p99 | Fine detail | Clean sand RGB |
|---|---|---|---|---|---|
| dusk-fire | 72 (70) / 77 / 56 / **75 (78)** | 69 / 38 / 52 / **50** | 128 / 97 / 88 / **100** | 9.0 / 2.6 / 6.3 / **4.1** | 108,64,39 / 119,68,38 / 92,48,26 / 116,66,37 |
| A spawn | 56 (54) / 79 / 60 / **77 (78)** | 78 / 40 / 50 / **47** | 116 / 99 / 90 / **102** | 9.2 / 2.6 / 6.3 / **4.0** | 84,49,36 / 121,70,39 / 96,52,30 / **117,68,39** |
| B logbook | 39 / 40 / 46 / **47** | 23 / 40 / 41 / 42 | 56 / 67 / 71 / 72 | 2.3 / 4.4 / 4.8 / 4.8 | 60,33,27 / … / 72,40,33 |
| C waymark | 32 / 21 / 16 / **18** | 15 / 40 / 19 / 26 | 47 / 55 / 35 / 37 | 1.1 / 1.2 / 1.5 / 1.5 | 51,27,22 / 37,15,17 / 31,10,15 / **34,13,16** |
| D hands | 35 / 31 / 18 / **31** | 32 / 23 / 24 / 24 | 53 / 43 / 36 / 44 | 1.3 / 1.1 / 2.3 / 1.4 | 49,30,27 / 50,25,26 / 33,13,18 / **50,25,26** |

The dune band: a 10-column luma grid of cell means. The rows are y 0.42 and 0.48. In the game these hold the tower
dune's camera face:

| View | Mockup shade / lit | r5 shade | r7 shade | r7 lit |
|---|---|---|---|---|
| dusk-fire | 46–50 / 81–88 (left block) | 29–33 | **23–26** | 82–86 (right flank) |
| A spawn | 35–42 / 85–93 | 28–31 | **24–25** | 69–75 |

Other patches:
- **Coil, D left arc** (strip without sand). Median / top 20 %: mockup 20 / 103,63,48; r6 38 / 119,67,38; **r7 29 /
  83,52,41**. The value and hue are back near the mockup ((R−B)/R 0.51 vs 0.53).
- **Glove back, D.** p95: mockup 75; r5 36; **r7 37**. Top 20 %: 96,59,44 / 60,27,26 / **62,31,29**. The glove has
  not moved since round 5.
- **C flame** (box x 150–450, y 350–900, pixels over luma 150): mockup 213 / r5 189 / r6 200 / **r7 199**.
  Saturated-orange pixels: 13 468 / 3 176 / 1 834 / **2 679**. White-hot pixels: 5 557 / 371 / 375 / **370**.
  **Pool** (x 150–450, y 1060–1150): 40 / 75 / 43 / **52**.
- **A sky box** (40,300–540,600): 88 / 86 / 85 / **82**. The p95 is 133 / 161 / 161 / **153**: the flakes are thinner
  (`sky.ts` coverage 0.55 → 0.64), but their shape is unchanged.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.0** | 1. **The shade face is a blob, not a terminator (x 0.25–1, y 0.38–0.58).** The tower dune has round 5's dark face back, but its left edge is a soft, near-vertical straight band from the crest to the foot, with the left half of the dome evenly lit. The aerials show why: it is the baked `uSandShadow` map. The shadow's west edge runs as a straight streaky line along the map axis, not along the dune's curvature. The mockup's shade wraps the whole camera face of the dome under a crisp crest, then sweeps diagonally across the saddle (y 0.48–0.56, x 0.5–1, 43–48), beside a lit left block of 81–88. The game's foreground row (y 0.54) is a flat 67–71 across the full width, and its lit flank is on the right. The shade is now darker than the mockup's (23–26 vs 46–50). 2. **The coil (x 0.33–0.6, y 0.6–0.85).** It is the mockup's size and dark brown again. But the procedural stagger renders as a checkerboard of pale tan tiles on dark brown, a tape or houndstooth, not a plait whose rounded strands catch a sheen. The glove has a white dashed line down the cuff that reads as a zipper. 3. **The sky (y 0.14–0.38).** There are fewer flakes, but they are the same pale-peach diagonal rows edge to edge. The mockup has an open orange glow with grey-brown banks only at the right, and layered grey dune ranges where the game has a flat lavender mountain cut-out. The grain is better than round 5's (4.1 vs 2.6) but lost a third of round 6's (6.3; mockup 9.0). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.5** | 1. **One dome under a giant tower (x 0–1, y 0.34–0.6).** The mockup's three or four receding knife-edge crests each run diagonally, lit at 85–93 against shade at 35–42, with a small tower on the farthest one. The game has round 5's single dome again. It carries the same vertical blob-edged shade (24–25), and its tower is ~1.5× the mockup's height on screen. The game's skyline sits at y ≈ 0.40; the mockup's dunes already fill y 0.36. 2. **Near sand too bright again (y 0.6–0.86).** Clean sand is 77 (p50 78) vs 56 (54), with RGB 117,68,39 vs 84,49,36. Round 6 had fixed this (60); the revert to round 5's light brought the defect back. The spread is 47 vs 78 and the grain 4.0 vs 9.2: the ripples are evenly lit bands with no black troughs or bright crowns. 3. **Coil and sky.** The mockup has two big dark rings entering from the bottom edge. The game has one checker-taped double loop at x 0.33–0.6, its fist higher. The sky holds pale cream flakes lighter than the sky behind them, where the mockup's wisps are red-orange with dark undersides. Sefa and her chip are the real first step. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** | 1. **The camp is unchanged since round 5 (x 0.15–1, y 0.42–0.55).** The canvas is one even self-lit orange, blown to white in patches on the left panel. The lantern is a pale rectangle with no glow, and no light falls onto the cargo, which is black slabs with no boards or sacks. The tent is a flat grey sheet cut by the right edge, the horse is end-on, and the smoke is a thin straight ribbon. The mockup has torn pale cloth catching the afterglow, glow only inside, and crates, sacks and wheel spokes all readable. 2. **The coil (x 0.3–0.6, y 0.6–0.85).** The mockup's big low rings are dark leather barely lifted off the sand. The game's checker tape is high-contrast against dim sand. 3. **Ground and sky.** The sand is still too bright (47 vs 39) and banded (detail 4.8 vs 2.3). The sky is plum, not the mockup's blue-violet starfield. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.5** | 1. **The fire (x 0.28–0.47, y 0.33–0.50).** One dark log stub now shows above the rim (`places.ts` lean −1.15 → −0.8, length 0.26 → 0.34), and the Λ stays gone. But the flame is unchanged from round 6: smooth cream tongues (2 679 saturated-orange pixels vs 13 468; 370 white-hot vs 5 557). There is no burning log pile inside it, and the embers are white specks, not orange streaks sweeping up-left. The mockup's ground pool is a saturated orange (69,33,23) that picks out ripples; the game's is a pale cream glow (83,45,30, luma 52 vs 40). 2. **The backdrop (x 0–1, y 0.28–0.45).** The next waymark is back at x 0.83, y 0.43 with its plume, which is a gain. But a dark dune face still fills the sky behind the brazier. The mockup has the bowl against open sky over a flat horizon at y ≈ 0.5, with a warm afterglow and a "WAYMARK 64 M" chip. 3. **Materials and ground.** The plinth is clean, regular brick and the post is twisted copper; the mockup has rough fieldstone and sooty iron. The near sand is maroon (34,13,16, luma 18) against neutral brown (51,27,22, luma 32), unchanged since round 5. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **5.5** | 1. **The composition is round 5's again (x 0–1, y 0.45–0.85).** The flank that round 6 put in front of the camera is gone, but this is still not the mockup. The mockup has a flat horizon at y 0.53 over long parallel ridge bands and smooth near sand. The game has a rolling, whorled ripple field and a hump the tower stands half behind (x 0.72–0.86, y 0.43–0.47), under its "SIGNAL TOWER 197 M" chip. 2. **The hero hand (x 0.4–1, y 0.55–0.86).** This is the close-up the mockup is built around. The coil's value is now right (median 29 vs 20), but its pattern is a checkerboard of pale rectangles that ignores the cord's direction. The mockup's plait has lozenge strands running along the cord, each with a crisp sheen. The glove is as it was in round 5: smooth, with bead fingers, p95 37 vs 75, no creases or worn highlights. The new stitching is a bright white dashed line along the cuff, which reads as a zipper; the mockup's seams are dark, tonal welts. 3. **Light and colour (y 0.30–0.55).** The sky column is round 5's exactly: it peaks at 122 in a thin stripe at y 0.48 where the mockup climbs to 153 across a wide band, and the mid-sky is 39 vs 56. The ground is round 5's 50,25,26 against 49,30,27: closer in value, still redder. |

**Seat score, Signal Dunes: (6.0 + 5.5 + 6.0 + 5.5 + 5.5) / 5 = 5.7.** This seat's earlier scores: round 1 4.6, round 2
5.1, round 3 4.9, round 4 5.2, round 5 5.6, round 6 5.3.

Against round 5, the gains are:
- C's fire no longer shows the Λ;
- the coil is the mockup's size and value;
- the grain is +1.5 (detail).

The losses: the coil's new checker pattern, the zipper-like stitch, and dune shade overshooting darker than the mockups.
Nothing that was already round 5's defect moved: the camp, the sky, the flame, the glove, the single dome, A's bright
near sand.

## Builder's claims checked

| Claim (round-7 README) | Verdict | Evidence |
|---|---|---|
| D median 37 (r5 36, mockup 40), rgb 57,31,32 | **Not reproducible; the frame is round 5's** | Clean sand: D 31 / 50,25,26, identical to round 5 (31 / 50,25,26); the mockup is 35 / 49,30,27. The whole sky column matches round 5's to the unit. The lift from `b3beecc14` (C 61,31,24) is not in this capture: C is 18 (34,13,16) vs 32. |
| dusk-fire and A at round 5's light (p50 75) | **True, and that is a defect for A** | dusk-fire p50 78 vs mockup 70 (fine). A p50 78 vs mockup 54: round 6's correct mean (60) was given back. |
| A fine detail 5.8 (r5 5.3); the grain kept | **Partly lost** | Clean patch: 4.0 (r5 2.6, r6 6.3, mockup 9.2). Seat A's box: 4.4 (r6 5.9). The grain is between round 5 and round 6, not kept. |
| The plait dark brown, diagonal strands, dark gaps, one warm rim each, sheen roughness 0.45 | **Dark brown: true. Plait: no** | `meshes.ts` still drives the pattern from model-space `gp` sines (×48), with `sb`'s sign flipping alternate rows. On the curved cord this renders as staggered pale rectangles, a checker tape. The "rim" is painted albedo (`smoothstep(0.45, 0.95, sp)`), not a lit edge, so it shows the same on the shade side of the coil. No strand-level sheen reads at 780 px. |
| A highlight on the crest band only | **True, small** | p99 100–102 (r5 97–99, r6 88–90) against the mockups' 116–128. No visible lit crest line in A or dusk-fire. |
| Dunes back to round 5's, terrain and navmesh re-baked | **True** | `dunes.ts` WAVE 128 / AMP 22 and `layout.ts` CRESTS 13 / 58 are global. The aerials match round 5's. The real cameras moved back exactly. |

## Findings, ranked by score gained

1. **Make the dune shade a terminator, not a baked blob** (dusk-fire, A, h1; x 0.25–1, y 0.38–0.6; every aerial).
   - Evidence: the tower dune's shade has a straight, streaky, near-vertical west edge that follows the shadow map's
     axis, not the dome's curvature. The aerial-overview shows the same: dark lobes with straight edges, a rectangular
     notched block (x 0.4–0.5, y 0.3–0.4) and a horizontal seam (y ≈ 0.37). The shade value overshoots (23–26 vs the
     mockups' 35–50).
   - Fix, in `render.ts`: let the self-shade come from the per-pixel `N·KEY` (the `sandKeyN` term already exists), with
     a crisp but curved falloff. Keep `uSandShadow` only for true cast shade from one dune onto the next.
   - Bake that map with soft, slope-following edges: march along the key, then blur across the key direction only, not
     a square smoothstep on a 640² texel grid. Raise the shade floor to ~35–45.
   - Then the tower dune's whole camera face goes dark under a crisp crest, as in both spawn mockups. Check it from the
     aerials, not only the mock views.
2. **Run the plait along the cord** (all five, D first; x 0.33–0.75, y 0.58–0.86).
   - Evidence: the value is right, but the pattern is a model-space checker. The mockups' lozenges follow the curve.
   - Fix, in the whip geometry and `meshes.ts`: give the cord a UV, u along its length and v around it. Draw strands as
     `fract(u·k ± v)`, two sets at ±45° to the tangent, each strand shaded across its width: dark at both edges, lighter
     at the crown. Add a normal tilt across each strand so the 0.45 roughness gives each strand a lit highlight on the
     key side only, instead of painting the rim into the albedo.
3. **Take back round 6's A ground mean without losing round 5's spawn light** (A, y 0.6–0.86).
   - Evidence: A's clean sand is 77 vs 56; dusk-fire's is right (75 vs 72).
   - Fix: the difference is the near slope's facing in A. Lower the lit-face albedo/key toward A's 84,49,36. Bring the
     spread from the top and the bottom (troughs to ~20, crowns to ~110), not from the mean.
   - Restore round 6's grain amplitude (detail 6.3), which this round cut to 4.0.
4. **The fire** (C, every lit brazier; x 0.28–0.47, y 0.33–0.66).
   - Fix, in `fireFx.ts`:
     - keep the tongues' edges saturated orange and put a white-yellow core low;
     - several log ends glowing inside the flame's base, not one dark stub;
     - embers as short orange streaks drifting downwind (up-left);
     - a widening smoke column.
   - The pool should be saturated orange with a falloff that rakes the ripples (target 69,33,23), not cream.
   - Weather the bowl and post to sooty iron and the plinth to irregular fieldstone.
5. **The glove's finish and the stitch** (D, all; x 0.55–1, y 0.6–0.86).
   - Evidence: p95 37 vs 75, unchanged since round 5.
   - Fix: add creases and panel seams as a normal or detail map, and break the sheen into many small highlights up to
     ~75–95 luma.
   - Draw the stitch rows as dark welts with thread only a step lighter than the leather, never white. The current
     dashed line reads as a zipper.
6. **The late-dusk sand hue** (C, D; y 0.6–0.86).
   - Evidence: C 34,13,16 and D 50,25,26 vs 51,27,22 and 49,30,27. Too red, and C too dark.
   - Fix: get `b3beecc14`'s lift into the shipped look this time, with the hue toward the neutral brown-violet, and show
     the C number on this clean patch.
7. **Sky and ranges** (A, dusk-fire, clip; y 0.12–0.40).
   - The flakes are thinner but the same shape. Move the clouds to low irregular banks: red-orange with dark undersides
     in A, grey-brown at the right only in dusk-fire.
   - Replace the flat lavender cut-out and the pale strips between the clip's range layers with hazy, layered dune
     ranges. Soften the hard top edge of the orange horizon band in the clip.
8. **The camp** (B; x 0.15–1, y 0.42–0.55). The same list as rounds 5 and 6:
   - the lantern's light falling off across the canvas, with no blown white patches;
   - a lantern glow;
   - light reaching boards and sacks;
   - the tent small and dark behind a side-on horse;
   - a widening plume.

## No-shortcut check (ledger 5)

- **Terrain:** reverted globally (`dunes.ts` WAVE/LEE/AMP_MAX, `layout.ts` CRESTS), re-baked with the navmesh. The
  aerials and hero views show the same field as round 5. No per-shot shaping, and the cameras blob is unchanged. The
  real cameras returned to round 5's camAt exactly, as the README says. No breach.
- **Look tuned only for the views:** none. The graze term, fill and floor are in the global sand shader. The plait, the
  logs and the stitch show the same in h1–h4 and the clip.
- **Staged state:** no staging commit. `meta.json` lists B (`logbook`) and C/D (`waymarks-lit`), the same handlers as
  rounds 4–6 verified. C keeps its flame, embers, plume, pool and step toasts. No frozen pose: one `HD_GLOVE` idle hold.
- **Painted stand-ins:** none in the playable area. Clouds and ranges are at infinity. The aerial shadow blobs and seam
  are real-world look defects (finding 1), not cards.
- **Device and HUD:** 390×844 phone and touch, stored 780 wide, baseline HUD, 30 fps chip. This surface has no memory
  or frame-time trace: unverified, not breached.

SCORE signal-dunes: 5.7
