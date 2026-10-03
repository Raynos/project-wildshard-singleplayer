# Round 5, seat C (Claude, red team: the demanding art director), Signal Dunes

Surface: `art/mockup-council/round-5/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0057-56c23085/` (every `mock-*`, the four hero views, both aerials,
`clip.mp4` sampled at 0.6 fps), against round 4's `progress/sunscar-dunes/20261003-0019-8221a34a/` and the five ledger
mockups at full resolution. Each mockup was scaled to 780×1688 and set beside the round-4 and round-5 frames as
triptychs, cropped region by region (sky band, tower dune, foreground, the wagon at 2×, the brazier at 1.1×, the fist and
coil at 1.3× and 1.5×). Everything is measured as Rec. 709 luminance (the brief): the earlier rounds' patches (sky
500×300 @40,300; zenith 400×150 @40,200; ground 500×250 @40,1050), the lower-left ground's p5–p95 and fine detail (mean
|luma − Gaussian-blurred luma|, σ 2 px) over x 50–390, y 880–1350, a 10×20 luma grid per frame, and named lit / shade /
glow / glove patches. Source checks: the diff `8221a34a..56c23085` in `src/shards/sunscar-dunes/` (`look/render.ts`,
`look/dusk.ts`, `look/sky.ts`, `plugin.ts`, `weapons/whipModel.ts`, `world/meshes.ts`, `world/places.ts`,
`world/build.ts`, `world/fireFx.ts`). Regions are fractions of the portrait frame (x left → right, y top → bottom).

What landed and is real: the black slabs are gone (the shade faces now sit on the mockups' values); the late zeniths
are blue-violet; the stepped dark strip is gone from both aerials; the wagon is lit; the glove left oxblood. Those are
the round's gains. What did not move is everything at the scale of surface and material: the sand's fine detail, the
fire, the glove's finish, the clouds' shapes, the coil's size. And one round-4 fix regressed to round 3's defect.

## The measurements (mockup / r4 / r5, Rec. 709 luma)

| View | Shade face | Lit face / crest | Lower-left ground p5–p95 (spread) | Fine detail | Horizon glow |
|---|---|---|---|---|---|
| dusk-fire | 32 (38,30,34) / 6 (21,2,2) / **31 (44,26,34)** | lit lower-left 76, p95 110 / — / 80, p95 92 | 41–106 (64) / 40–76 (35) / 46–91 (45) | 8.0 / 1.1 / 1.8 | 100 (150,89,58) / — / **160 (223,147,91)** |
| A spawn | 39 (46,35,45) / 4 / **30 (44,25,34), sd 1** | 99, p95 123 / — / 76, p95 92 | 19–110 (91) / 34–79 (44) / 35–94 (58)* | 7.8 / 2.2 / 2.7 | 144 (229,126,61) / — / **171 (240,157,95)** |
| B logbook | — | — | 16–51 (35) / 43–94 (51) / 32–84 (51) | 2.3 / 3.2 / 2.9 | — |
| C waymark | — | — | 23–104 (81) / 13–122 (108) / 8–112 (104) | 1.8 / 0.9 / 1.0 | — |
| D hands | — | — | 10–63 (52) / 39–58 (19) / 26–49 (22) | 0.8 / 0.5 / 0.5 | — |

\* A's patch includes Sefa; on clear sand (x 0–0.3, y 0.7–0.83) the mockup is 58 (sd 20) and the game **83 (sd 9)**.

| View | Sky patch (mockup / r4 / r5) | Ground patch (mockup / r4 / r5) |
|---|---|---|
| B | 49,46,92 / 54,36,64 / **53,38,68** | 59,31,26 / 84,51,40 / **71,42,36** |
| C | 63,47,70 / 38,27,42 / **44,36,58** (luma 52 / 31 / 39) | 62,31,22 / 85,46,30 / **77,42,28** |
| D | 49,46,90 / 26,17,46 / **37,34,73** (luma 50 / 21 / 38) | 58,34,31 / 70,38,36 / **56,30,30** |

| Glove, D (x 0.76–0.97, y 0.66–0.75) | RGB | Luma | sd | p99 | Fine detail |
|---|---|---|---|---|---|
| mockup | 49,27,22 | 32 | 25 | 116 | 8.8 |
| r4 | 35,8,4 | 14 | 12 | 41 | 1.3 |
| r5 | 40,17,17 | 22 | 9 | 39 | **1.0** |

Reading:
- **The shade is solved at the value level.** 30–31 against 32–39, violet-brown, no longer black. But it is flat
  (A sd 1) and so is the mockups' (sd 1–3), so this is right.
- **The light end did not come up where it matters.** The key went 2.3 → 3.0, but it lit the broad near sand, not the
  crests: A's near sand is now 25 brighter than the mockup's (83 vs 58), with half its sd, while A's lit crest is 23
  darker (76 vs 99) and the brightest ground anywhere is ~92 against the mockup's 123. The mockups put their light in
  thin grazing crest lines and ripple tops over a darker field; the game puts it in a bright, even field. The spread
  rose (A 44 → 58 of 91, dusk-fire 35 → 45 of 64) only because the shade blocks are back in the patch.
- **The fine scale did not move at all**: detail 1.8–2.7 against 7.8–8.0 in the two spawn views, glove 1.0 against 8.8.
  This is the single largest unaddressed difference across five rounds; it is what makes the game read as smooth CG
  beside the mockups' grain, plait and creased leather.
- **The horizon glow is now too hot and too pale.** A 171 (240,157,95) against 144 (229,126,61); dusk-fire 160 against
  100. The mockups' glow is a saturated orange; the game's is a pale yellow-white stripe.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.0** | 1. **The ground's light and surface (x 0–1, y 0.42–0.85).** The black slab is gone: the tower dune's face is a violet-brown 31 against the mockup's 32, a real gain. But its left edge is still a soft vertical smear that follows no crest (x 0.18–0.25, y 0.42–0.55: the baked shadow map's edge, not a terminator), the mockup's near saddle in shade sweeping across the centre (y 0.5–0.6, 62 with sd 23) is still a flat plain, and the lit lower left is a fine regular sine corduroy (detail 1.8) where the mockup's is coarse, grazing-lit grain with bright crests (detail 8.0, p95 110 vs 92). 2. **Sky (y 0.12–0.38).** The flakes became irregular cream-and-peach banks with dark cores, closer to cloud, but they still fill the whole band edge to edge in diagonal rows; the mockup has a clear orange glow with a few grey-brown banks at the right only (x 0.65–1, y 0.25–0.35). The horizon glow is a hot pale stripe (160 vs 100). No ray over the tower and an unlit lamp (the mockup's two subjects besides the tower). 3. **Hand (x 0.5–1, y 0.55–0.85).** The coil now leans left and lower (the ruling), but its ring is about 0.2 of the frame wide where the mockup's single low loop spans ~0.35; the plait reads as beads, the glove a smooth dark-grey rubber with no creases or lit seams. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.5** | 1. **One dome, not receding crests (x 0–1, y 0.39–0.62).** The tower dune is still the nearest mass, filling the middle from x 0.1 past the right edge with a flat plain behind and a flat lavender range; the mockup's tower stands on the farthest of three or four overlapping knife-edge rows, each a thin bright crest (99, p95 123) beside a violet shade face, cooling with distance. The shade face now has the right value (30 vs 39) and the form reads, the reason for +0.5. 2. **Foreground (y 0.6–0.85).** Bright even sand with regular parallel ripples (83, sd 9, detail 2.7) against the mockup's darker field of bold irregular ripples with lit crests, black troughs and grain glints (58, sd 20, detail 7.8): the key raised the field, not the ripple tops. 3. **Sky and coil (y 0.15–0.38; x 0.45–0.7, y 0.68–0.88).** Cream-peach banks in diagonal rows against the mockup's small red-orange wisps lit from below; a pale-yellow horizon stripe (171 vs 144). The mockup's two big rings span x 0.27–0.67 entering from the bottom edge; the game's ring spans about x 0.46–0.66, held up by the fist at the right. Sefa and her chip are the real first step and stay. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** | 1. **The wagon is lit, but as a lamp, not by one (x 0.3–0.6, y 0.42–0.55).** `warmByFire` on `wagon-hd` (`meshes.ts`) now shows hoops, the canvas's folds, a spoked wheel and the tailboard: real gain. But the outside of the canvas facing the camera is as bright and as orange as the inside under the hoops, so the shell reads self-lit; the lantern is still a pale rectangle with no glow; the mockup's canvas outside is pale torn cloth catching the afterglow, its glow only inside. White specks at the wheel base (x 0.45–0.55, y 0.54). 2. **Props (x 0.15–0.3 and 0.83–1, y 0.45–0.55).** The crates and sacks are still black slabs with no planks (the lantern light does not reach them); the tent is still one flat grey sheet cut by the right edge (TENT_CANVAS darkened, the shape unchanged); the horse end-on black; the cookfire smoke a straight thin ribbon. 3. **The glove's white blob and the ground (x 0.64–0.72, y 0.66–0.69; y 0.55–0.9).** A near-white specular blob on the top of the fist (max luma 243, 217 px above 150) is the brightest thing in the frame bar the HUD; the mockup's glove is matte dark. The sand is still too bright (71,42,36 vs 59,31,26) and the sky still plum (53,38,68 vs 49,46,92). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.0** | 1. **The Λ is back (x 0.3–0.42, y 0.42–0.50).** The fix for round 4's bars reverted the crown lean to round 3's value (`places.ts` `kindling`: −1.05 → −0.42), so the logs again stand as a glowing red tent-shaped "Λ" above the rim inside the flame, the exact defect round 3 named; and with `emissive: 0x6a1c04` always on, **the unlit brazier in `h3-waymark` shows a red glowing Λ** too. The flame is still smooth pale cream tongues (the core was cut, `fireFx.ts`), against the mockup's ragged orange mass over burning logs; the embers are sparse white dots, not orange streaks sweeping up-left; the plume a soft pale column. 2. **Backdrop and light (x 0–1, y 0.2–0.68).** The dark dune shoulder still fills the upper left behind the bowl (the mockup: a low flat horizon, sky round the bowl); the sky is still dark (luma 39 vs 52); the pool is a pale band across the frame (77,42,28 vs 62,31,22), not a tight orange glow at the plinth. 3. **Brazier and hand.** Clean new brick plinth and a twisted copper column against the mockup's sooty iron post on rough fieldstone; the mockup's big low coil vs the game's small one. The toasts and the next waymark are right. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **5.5** | 1. **The hero glove is a smooth rubber mitt (x 0.6–1, y 0.6–0.85).** The colour moved off oxblood (40,17,17), but its value fell further from the mockup (luma 22 vs 32), it has no highlights at all (p99 39 vs 116) and a tenth of the fine detail (1.0 vs 8.8): no stitched panels, no creased knuckles, no lit seams. The pale patch at the top of the fist is still there (x 0.8, y 0.61). The plait is a grey-brown caterpillar of beads, not two crossing strands with dark gaps; the coil now leans away from the mockup's upright loop (D's own hold, overruled for the four others, which is fair). 2. **The tower is still buried (x 0.72–0.85, y 0.40–0.47).** Unchanged since round 4: the tower dune's hump hides the tower's lower half and its "SIGNAL TOWER 197 M" chip covers the cabin; the mockup's stands whole on a flat horizon. 3. **Ground and sky (y 0.45–0.85; y 0–0.45).** The zenith is now the mockup's (30,32,73 vs 27,31,70) and the sky close (luma 38 vs 50): the round's best change here. But the ground is still rolling dunes covered edge to edge in whorled ripples (spread 22 vs 52) where the mockup has long flat parallel ridge bands with dark lee lines and smooth near sand, and the afterglow is still a thin hot orange line rather than a wide peach-pink band. |

**Seat score, Signal Dunes: (6.0 + 5.5 + 6.0 + 5.0 + 5.5) / 5 = 5.6** (this seat: round 2 5.1, round 3 4.9, round 4 5.2).

## Builder's claims checked

| Claim (round-5 README) | Verdict | Evidence |
|---|---|---|
| Shade faces cool violet-brown, not black | **true** | A 30 (44,25,34) vs 39; dusk-fire 31 vs 32 (table). `render.ts`: key ×0.08 in cast shade, a cool fill term added. |
| Brighter lit crests; A spread 62, dusk-fire 34 | **brighter field, not crests** | Key 2.3 → 3.0. My A spread 58 (Sefa in patch), dusk-fire 45. The crest lights stay below the mockups' (76 vs 99; p95 92 vs 123); the near field went above it (83 vs 58). |
| D ground (57,30,31), zenith (31,33,74) | **true** | 56,30,30 and 30,32,73. |
| The logs back inside the bowl | **true, by re-creating round 3's Λ** | The lean is round 3's −0.42 (C row); the red emissive glows on the unlit brazier in h3. |
| Glove neutral dark brown with sheen, thumb patch fixed | **half** | Off oxblood, yes. The sheen shows only as one white blob (B: 243 luma); D has no highlight at all (p99 39). The patch still reads pale at the fist top in A, B and D. |
| Sunset clouds irregular banks with dark cores | **true in shape, not in placement** | Still edge to edge across y 0.15–0.36 in A and dusk-fire. |
| Late skies blue-violet | **D yes; B and C partly** | D zenith matched; B still plum (53,38,68), C still dark (39 vs 52). |
| Tent dark canvas | **colour only** | Still one flat sheet at B's right edge. |
| Far-sand stepped strip fixed | **true** | Gone from both aerials and h4 (`render.ts` lights the sand past the map's edge). |
| Wagon lit by its own lantern | **true, as a uniform glow** | `warmByFire` on the whole `wagon-hd` material: the canvas's outside glows as much as its inside (B row). |
| The idle the big low coil (the lead's ruling) | **lower and left, not big** | `HD_GLOVE` size 0.2 → 0.22 and rot (−0.45, 0, 0.25): the ring is ~0.2 of the frame wide against the mockups' ~0.35–0.4. |

## Findings, ranked by score gained

1. **Put the light in the crests and ripple tops, not the field** (A, dusk-fire, then B, D; y 0.4–0.85). Evidence: A's
   near sand 83 / sd 9 vs 58 / sd 20; A's crest 76 vs 99, p95 92 vs 123; detail 1.8–2.7 vs 7.8–8.0 in both spawn views.
   Fix: lower the broad near-field key back toward the mockup's 58 and push the energy into the slope term instead (a
   sharper `NdotL` response on the slip faces and a narrow highlight on the crest line), and give the near ripples
   irregular, asymmetric profiles (a steep lee side going dark, a lit stoss side) plus a coarse grain map whose bright
   specks catch the low key. Targets: A clear-sand patch (x 0–0.3, y 0.7–0.83) 58 with sd ~20; crest p95 ~120; the
   lower-left fine detail toward 7–8. The mean will fall while the spread rises; that is the point.
2. **Fix the brazier logs for real, both states** (C, h3, h4; x 0.3–0.42, y 0.42–0.50). Fix: neither −1.05 (bars through
   the cage) nor −0.42 (the Λ): lay 6–8 shorter logs (~0.3 m) as a low criss-cross pile whose tips stay inside the bowl's
   inner radius, below the rim line from eye height, so the flame hides their tops; take the `0x6a1c04` emissive off
   the crown material and switch it on only when the brazier is lit (h3 shows a glowing Λ on an unlit bowl). Then the
   flame: ragged orange tongues with a yellow core (the mockup's ~245,200,131 core, orange edges), embers as orange
   streaks drifting up-left, the pool a tight radial glow at the plinth (~62,31,22 at the ground patch).
3. **The glove's surface, not its colour** (all five; D is the hero; x 0.6–1, y 0.6–0.85). Evidence: detail 1.0 vs 8.8,
   p99 39 vs 116, luma 22 vs 32; the B blob at 243. Fix: a normal or detail map carrying the painted seams and creases
   (or a re-bake at higher texture resolution) so the knuckles and seams catch light; raise the base toward luma ~32 and
   spread the sheen as many small highlights on the creases (roughness up from 0.32, with a roughness map, so it stops
   pooling into one chrome blob); paint out the pale patch at the fist top rather than clamping it. The plait: two
   crossing strand directions with dark gaps (a normal map), not rings.
4. **The coil the ruling asked for** (A, B, C, dusk-fire; x 0.25–0.75, y 0.62–1.0). The ring is about half the mockups'
   width. Fix: in the single idle constant, scale the coil (not the glove) up ~1.7× and let it hang lower so the rings
   enter from the bottom edge across the centre as A, B and C show; keep one constant, no per-camera transform, and the
   same coil in the attack's return.
5. **Light the wagon from the lantern, not the material** (B, h2; x 0.3–0.6, y 0.42–0.55). Fix: limit `warmByFire` on
   `wagon-hd` to faces that see the lamp (a distance and `N·L` falloff from `lampAt`, so the outside of the canvas stays
   pale and lit by the afterglow), add a glow sprite at the lantern, let the falloff reach the crates at the left so
   their planks read; the tent as a ridged tent shape, small and dark behind the horse; a widening plume for the
   cookfire; remove the white specks at the wheel base; bring the sand to ~59,31,26.
6. **The sky: placement and glow** (A, dusk-fire; y 0.12–0.40). Fix: confine the banks to the band within ~0.12 of the
   frame above the horizon and thin them out (dusk-fire: a few banks at the right only; A: small wisps lit red-orange
   from below); bring the horizon glow down and toward saturated orange (A 229,126,61 at luma ~144; dusk-fire luma
   ~100). B and C: lift the sky toward 49,46,92 and 63,47,70 (more blue, less red).
7. **Depth in A and D** (A y 0.37–0.62; D x 0.72–0.85, y 0.40–0.47). Open since round 4: add the receding crest rows
   between the spawn and the tower dune, and lower the tower dune's D-facing flank so the tower stands whole from D's
   camera; give D's field long parallel bands with dark lee lines and smooth near sand.

## No-shortcut check (ledger 5)

- **Staged state: reachable.** `stage()` is unchanged. But `plugin.ts` did change: `duskOf` raises the dusk after
  Sefa's flag from 0.25 to 0.38, which re-lights the staged B view (logbook unread, Sefa's flag set). It applies to
  every player at that quest step, so it is real state, not a breach; the README's "no commit touched staging code" is
  true of `stage()` but should name this, since it changes a staged frame's light. It also means the mockups' golden
  look now ends sooner in play.
- **Frozen poses, dropped effects:** none. The viewmodel is one constant (`HD_GLOVE`); C keeps its flame, embers, plume
  and toasts.
- **Views:** no camera changed; `camAt` is recorded for comparison from round 6.
- **A look only for the capture:** none. The key, the shade, the wagon's firelight (`build.ts`, always burning) and the
  brazier logs are in the hero views and the clip too; h3 shows the Λ defect even worse than the scored view.
- **Painted stand-ins:** none in the playable area; the range and clouds are at infinity. The clip's late frames show
  pale strips between the range's cut-out layers (as in round 3): at infinity, a look defect, not a breach.
- **Device and HUD:** 390×844 phone and touch stored at 780 wide, baseline HUD, 30 fps chip, 0 page errors.

SCORE signal-dunes: 5.6
