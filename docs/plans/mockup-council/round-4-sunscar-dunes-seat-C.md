# Round 4, seat C (Claude, red team: the demanding art director), Signal Dunes

Surface: `art/mockup-council/round-4/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0019-8221a34a/` (every `mock-*`, the four hero views, both aerials,
`clip.mp4` sampled at 0.6 fps), against round 3's `progress/sunscar-dunes/20261002-2351-a9e50413/` and the five ledger
mockups at full resolution. Each mockup was scaled to 780×1688 and cropped beside the game frame region by region (sky,
horizon and tower, shade faces, foreground, the fist at 3×, the brazier, the wagon). Measured with ImageMagick on the same
patches as round 3 (sky 500×300+40+300, zenith 400×150+40+200, ground 500×250+40+1050, ground sd over 390×420+0+880 and
780×300+0+850), plus the darkest 60 px landscape tile per frame and the shade faces. Source checks: the diff
`a9e50413..8221a34a` in `src/shards/sunscar-dunes/` (`look/render.ts`, `look/sky.ts`, `world/meshes.ts`,
`weapons/whipModel.ts`, `world/places.ts`, `world/fireFx.ts`) and the commit messages of `fc53958d0`, `21a32cd87`,
`9c1b6a4f3`, `4174b8d99`, `8221a34a4`; the captured cameras blob `d78968c7`. Regions are fractions of the portrait frame
(x left → right, y top → bottom).

What landed and is real in the frames: the tower crowns a big dune again in A and dusk-fire, and dusk-fire's horizon came
up (pitch −10); the glove is a new textured gauntlet out of the fog, now darker than the sand behind it, with a cuff; the
near sand at the spawn is rippled to the bottom edge; the late skies lost their ruled streaks; B now sees the wagon's
side; the trail cairns are gone. The ground's tonal spread rose (A left-half sd 9 → 15, mockup 26). This seat scores the
picture.

## The measurement that matters this round: the shade overshot into a black void

| View | Darkest 60 px landscape tile (mockup / r4) | Shade face RGB (mockup / r4) | Ground sd left half (mockup / r4 / r3) | Sky patch (mockup / r4) |
|---|---|---|---|---|
| dusk-fire | 30 / **4** | saddle 63,44,39 / **21,3,3** | 20 / 12 / 11 | 104,69,56 / 133,81,78 |
| A spawn | 22 (that is the whip) / **4** | 39,32,42 (luma 34) / **20,1,1 (luma 5, sd 1)** | 26 / 15 / 9 | 133,77,69 / 123,75,76 |
| B logbook | 17 / 5 (the glove) | | 12 / 15 / 7 | 49,46,92 / **55,37,64** |
| C waymark | 13 / 13 | | 26 / 35 / 27 | 63,47,71 / **39,27,43** |
| D hands | 12 / 8 (the glove) | | 19 / **6** / 4 | 49,46,91 / **27,17,47** |

Round 3's seat C asked for the troughs, lee lines and creases to reach near-black. The builder darkened the whole shaded
face instead (`render.ts`: `directDiffuse *= mix(0.2, 1.0, sandVis)` with `smoothstep(0.25, 0.75, …)` on the baked map,
and the fill at the spawn's dusk scaled by `mix(0.62, 1.15, uDusk)` = 0.62). The tower dune's camera-facing half is now
a flat red-black slab (20,1,1: the blue and green channels are gone, so the cool violet sky fill the mockups' shade
carries is gone with them), with no ripple or grain inside it, and its left edge is a soft vertical smear that follows no
crest (A x 0.47–0.52, dusk-fire x 0.22–0.27). The mockups' shade faces are mid-dark cool violet-brown (A 39,32,42) with
the form still readable. Meanwhile the late skies went the other way: B, C and D are now a dark plum where the mockups are
a clear blue-violet (D 27,17,47 against 49,46,91: half the value, red where it should be blue).

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **5.5** | 1. **The shade face is a black hole (x 0.22–1, y 0.40–0.57).** The composition is now right (the tower on a big dune, a shaded saddle in front, the horizon up near the mockup's), but the mockup's shade is a cool violet-brown with the saddle's form and a crest line readable (63,44,39); the game's is a red-black slab (21,3,3) with a blurred vertical edge at x 0.22–0.27 and a murky red smear where it ends (x 0.8–1, y 0.53). The lit grain-textured sand of the mockup's lower left (bright, coarse, grazing) is a uniform mid-brown with fine sine ripples in the game (high-pass detail 2 against 13). 2. **Sky (y 0.15–0.42).** The mockup: a clear orange glow to high up with a few grey-brown banks at the right. The game: rows of hard-edged pale cream flakes hatched diagonally across the band (`sky.ts` stretches the cloud noise 1.1 × 7.0 and thresholds it at `smoothstep(0.6, 0.64)`), no dark cores, no lit bellies; violet above. No dune ray over the tower, tower lamp unlit (the mockup's subject). 3. **Hand and whip (x 0.55–1, y 0.55–0.85).** The mockup: one low diagonal loop of crisp plait with bright strand edges, a dark creased glove at the bottom edge. The game: an upright double coil that reads as a segmented worm (rings, not crossing strands), held high at the right. Sefa's elbow at the left edge (x 0, y 0.62). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.0** | 1. **One near dune, not receding crests (x 0–1, y 0.37–0.62).** The mockup's tower stands on a far crest behind three or four overlapping knife-edge rows that recede and cool with distance into a hazy range. The game's tower dune is the nearest mass and fills the middle from x 0.1 to beyond the right edge; behind it is a flat plain and a flat lavender range cut-out; there are no intermediate crests, so the depth is gone. Its right half is the black slab (luma 5, sd 1, x 0.47–1, y 0.40–0.55). 2. **Sky (y 0.15–0.38).** The mockup's red-orange wisps with dark undersides at two scales; the game's stamped cream flakes in diagonal rows, the same pattern as dusk-fire. 3. **Foreground (y 0.6–0.85).** Ripples now reach the bottom edge (real progress, `8221a34a4`), but they are a regular sine corduroy in one mid-brown, without the mockup's lit crests and dark troughs under grazing light or its grain; ground sd 15 against 26. Sefa and her chip are the quest's real first step and stay. Viewmodel as dusk-fire. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **5.5** | 1. **The wagon finish (x 0.3–0.6, y 0.42–0.55).** The camera now sees the side as the mockup does, but the mockup's wagon has hoops, torn sagging canvas, a planked tailboard and spoked wheels, lit warm from inside by a glowing lantern. The game's canvas is a smooth dark maroon shell, the opening is a flat uniform peach plane, the lantern a small rectangle on a stick with no glow, and the wheels and tailboard one dark silhouette. Crates and sacks (left, y 0.5) are dark red slabs with no planks visible. 2. **Sky (y 0.05–0.42).** The mockup's clear blue-violet starfield (49,46,92) over a narrow orange glow; the game's dark plum (55,37,64) with tiny stars. The smoke is still a straight pale vertical beam (x 0.55, y 0.2–0.52), not a widening drifting plume. 3. **Tent and ground (x 0.88–1, y 0.45–0.53; y 0.55–0.85).** The tent is a large flat pale-grey sheet cut by the right edge, brighter than anything else in the camp; the mockup's is small and dark beside the horse. The sand is a stripe of bright pool under the wagon then broad diagonal bands, brighter than the mockup's (85,51,40 against 59,32,26). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.0** | 1. **Fire and brazier (x 0.27–0.47, y 0.33–0.62).** The flame is a smooth pale cream sprite (213,158,105), paler than round 3; the mockup's is a ragged orange mass over burning logs. New this round: **flat glowing-red sticks poke horizontally out through the bowl's cage** on both sides (x 0.27, 0.34, 0.45, y 0.48–0.50; also in `h3-waymark`): `places.ts` `kindling()` now leans the crown logs at −1.05 rad, so 0.5–0.62 m sticks lie almost flat and pass through the bowl, and their emissive `0x6a1c04` makes them glow red. The column is a twisted rope-like spiral on a crisp clean brick plinth, against the mockup's iron post on rough fieldstone. 2. **Backdrop (x 0–1, y 0.28–0.55).** A dark dune shoulder fills the upper left to y 0.28, so the brazier stands against sand, not sky; the mockup's horizon is low and flat with violet sky round the bowl. The sky is too dark (39,27,43 against 63,47,71). The plume is a faint pale column behind the minimap; the embers are sparse white dots, not the mockup's orange streaks sweeping up-left. 3. **The pool and hand (y 0.57–0.66; x 0.6–1).** The light pool is a flat pale band across the whole frame width (130,76,42), not a tight saturated glow round the plinth (72,35,24). The mockup's hand is a big low coil and a backlit glove; the game's is the upright worm coil. The next waymark and the toasts are right; the "5 M" chip is still cut at the left edge (x 0, y 0.25). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **5.0** | 1. **The hero glove (x 0.55–1, y 0.58–0.85).** The pose now matches the mockup's closely (fist low right, coil upright beside it, cuff off the corner), and the glove is out of the fog. But at 3× the plait is a column of rounded beads (a segmented caterpillar), not two crossing strands with dark gaps; the coil's silhouette is lumpy with a flange at the top of the loop (x 0.6, y 0.6); there is an unpainted white patch at the thumb (x 0.77, y 0.65); the leather is a saturated oxblood (43,13,10) with no specular (brightest pixel 139) where the mockup's is a dark worn brown (46,26,22) with lit knuckles, seams and creases (brightest 241). 2. **The tower is buried (x 0.75–0.85, y 0.40–0.47).** The raised tower dune (`4174b8d99`, CRESTS lift 13 over 58 m) now hides the lower half of the tower behind a crest, and its "SIGNAL TOWER 197 M" chip covers the cabin; the mockup's tower stands whole and clear on a flat horizon. The README's "yaw 46: 50 put the tower under its own label" did not clear it. 3. **Ground and sky (y 0.45–0.85; y 0–0.45).** The mockup: long flat parallel ridge bands with dark lee lines and smooth near sand. The game: rolling dunes covered edge to edge in a dense whorled ripple pattern (sd 6 against 19). The sky is half the mockup's value and plum instead of blue-violet (27,17,47 against 49,46,91), the afterglow a thin hot orange line instead of a wide peach-pink band; ember sprays sparkle on the horizon at x 0.2 and x 0.97. |

**Seat score, Signal Dunes: (5.5 + 5.0 + 5.5 + 5.0 + 5.0) / 5 = 5.2** (this seat: round 2 5.1, round 3 4.9).

## Builder's claims checked

| Claim (round-4 README) | Verdict | Evidence |
|---|---|---|
| Regenerated stitched gauntlet, flared cuff, plaited coil, out of the fog, dark painted leather, posed as D frames it (the idle) | **half** | Out of the fog, darker than the sand, cuff present, pose close to D. The plait reads as beads, the stitching is not legible at the frame's size, a white patch at the thumb, no specular, oxblood not brown (D row). `HD_GLOVE` is one constant transform: the idle, no per-camera pose. |
| Tower crowns a big dune again; dusk-fire's dark dune and saddle | **true for the form, at a cost** | A and dusk-fire: yes. The shade is a black slab (table); D's tower is now half buried behind that dune. |
| Deep shadows, darker ripple troughs, less fill | **overshot** | Darkest tiles 4 against the mockups' 22–30 on shade faces; the shade lost its cool fill (20,1,1). Ripple troughs are darker near the camera (A). |
| Crisp thin cloud bands low over the horizon, violet skies | **crisp yes, cloud-like no; violet overshot to plum** | Hard-edged flakes in hatched rows (A, dusk-fire); B, C, D sky patches half value or red-shifted (table). |
| mock-B three-quarter from behind the tailboard | **true** | The side and wheels run off right as in the mockup. |
| No trail cairns; planked crates | **cairns gone; planks not legible** | B crates read as dark slabs at 22 m. |
| The flame base fixed | **broke** | The crown logs now pierce the bowl as glowing red bars (C row). |
| A dark ray | **not in any scored frame** | Dusk-fire, its subject, shows none. |

## Findings, ranked by score gained

1. **Shade faces: cool mid-dark violet with the form inside, not black** (A, dusk-fire, and every dune in the aerials;
   x 0.2–1, y 0.4–0.6). Evidence: the table; `render.ts` floor 0.2 on the direct light plus the fill at 0.62 at the spawn.
   Fix: put the floor back on the fill, not the key, and keep the fill's cool colour in shade: target A's shade face
   39,32,42 and dusk-fire's saddle 63,44,39 at those regions, with the ripple and grain modulation still visible in
   the shade. Make the dark come from the lee lines and trough bottoms (narrow), not from the whole face. Draw the
   lit/shade split at the crest from the terrain normal against the key (a sharpened terminator), so the edge follows the
   crest; use the baked map only for cast shadow across a saddle. Re-measure the darkest-tile and shade-face columns.
2. **The viewmodel's material, not its pose** (all five; x 0.55–1, y 0.55–0.85). Fix: a plait with two crossing strand
   directions and dark gaps (a normal map or a tighter re-bake of the coil; the current paint reads as rings); smooth the
   coil's silhouette and remove the flange at the top of the loop; paint or mask the white patch at the thumb; pull the
   leather from oxblood toward D's dark brown (46,26,22) and give it a specular so the knuckles, seams and cuff edge
   catch light (the mockup's highlights reach ~240). Separately, for the lead: four of five mockups (A, B, C, dusk-fire)
   hold big low diagonal coils across the bottom centre and only D holds the upright coil; one idle cannot match both,
   so the lead should rule which hold the idle is, as it ruled Sky Reach's span. No per-camera transform either way.
3. **Clouds that read as clouds, and the late skies blue-violet** (all five; y 0.05–0.45). Fix: undo the 7× stretch and
   the 0.6–0.64 threshold in `sky.ts`; soft-edged banks at two scales with dark cores and red-orange bellies toward the
   glow (A), grey-brown in dusk-fire, below ~0.15 of the frame over the horizon. For B, C and D, target the mockups' sky
   patches (B 49,46,92; C 63,47,71; D 49,46,91): the `dusk` and `indigo` colours changed this round (`0.24, 0.18, 0.27`
   and `0.1, 0.08, 0.16`) are warm grey and too dark; move them toward the mockups' blue-violet and widen D's
   afterglow into a peach-pink band.
4. **Fix the waymark fire you just broke, then finish it** (C, h3; x 0.25–0.5, y 0.3–0.65). Fix: keep the crown
   logs inside the bowl (shorter, or leaned so the tips stay inside its radius) and drop their emissive outside the lit
   state; a pile of logs with glowing ends; ragged orange tongues instead of the pale cream sprite (target the mockup's
   core ~245,200,131 with orange edges); embers as orange streaks sweeping up-left; the plume grey and billowing; the pool
   a tight radial glow round the plinth (72,35,24), not a band across the frame; a sooted iron post on fieldstone.
5. **Get the depth back into the spawn view** (A, then D; y 0.37–0.62). The lift 13 over 58 m gave A and dusk-fire their
   subject but made it the nearest mass and buried D's tower. Fix: in the terrain, keep the tower dune but add the
   mockup's intervening rows between the spawn and it (A has three or four receding crests, each cooler and hazier), and
   lower the crest between D's camera and the tower so the tower stands whole on the horizon there; move D's yaw only if
   the chip still covers it. Re-bake, walk 0 stuck, and attach the walk result to the round (none is in the round README).
6. **The caravan as a lit built object** (B; x 0.25–1, y 0.42–0.55). Fix: a warm point light in the wagon so the canvas
   underside, hoops and tailboard planks glow; a lantern glow sprite; canvas with hoop ridges and torn sagging edges
   instead of a smooth shell; enough light on the crates for the planks to read; the tent smaller and darker, behind the
   horse; the cookfire smoke widening and drifting (it is still a beam).
7. **D's ground: long parallel bands, smooth near sand** (D; y 0.5–0.85). The ripple boost of `8221a34a4`
   (`sandPatch` forced on within 30 m, troughs ×0.62) suits A and contradicts D, whose near sand is smooth. Fix: let the
   patch mask, not the camera distance, decide where ripples are, with a smooth swale in D's foreground; give D's middle
   ground long transverse ridges with dark lee lines.

## No-shortcut check (ledger 5)

- **Staged state: reachable.** No commit between the captures touches staging (README); `stage()` is round 3's, whose
  reachability round 3 checked (Sefa's flag; the logbook, well, oil and crack per waymark). Listed in `meta.json`.
- **Frozen poses and dropped effects:** none. The viewmodel is the idle hold (`HD_GLOVE`, one constant); C keeps its
  flame, embers, plume and toasts. No attack frame is scored, so whether the textured glove survives a lash is unchecked.
- **Re-aims:** B (−65.5, 48.5, yaw 31.5 → −58.8, 42.1, yaw 53.8) moves toward the mockup's three-quarter view; dusk-fire
  pitch −3 → −10 brings its horizon toward the mockup's; D yaw 50 → 46 is toward the mockup's tower position but did not
  clear the chip (D row). None dodges a weak area: the hero views and aerials show the same black shade faces, pale
  flame and worm coil, so the mock views hide nothing worse.
- **A look only in the capture:** none found. The near-ripple boost is keyed on camera distance, so it is on wherever a
  player stands; the black shade and the cloud flakes are in the hero views and the clip too.
- **Painted stand-ins:** none in the playable area; the range and clouds are at infinity. The aerials still show hard
  dark rectangles in the baked shadow (`aerial-overview`, a long dark bar from the tower) as in round 3.
- **Narrowing:** the raised tower dune made the D view worse (a scored view, not hidden). The terrain and navmesh were
  re-baked (`4174b8d99`), but this round carries no walk or parity result: missing proof, not a breach.
- **Device and HUD:** 390×844 phone and touch, stored 780 wide, baseline HUD, 30 fps chip, 0 page errors. No breach.

SCORE signal-dunes: 5.2
