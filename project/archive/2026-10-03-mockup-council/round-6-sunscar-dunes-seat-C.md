# Round 6, seat C (Claude, red team: the demanding art director), Signal Dunes

Surface: `art/mockup-council/round-6/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0132-28e3eb78/` (every `mock-*`, the four hero views, both aerials,
`clip.mp4` sampled at 1 fps) against round 5's `progress/sunscar-dunes/20261003-0057-56c23085/` and the five ledger
mockups at full resolution. Each mockup was scaled to 780×1688 and set beside the round-5 and round-6 frames as
triptychs, cropped by region (the dune band, the sky, the foreground, the coil and glove at 1.5×, the brazier at 2×, C's
right horizon at 2×). Everything is Rec. 709 luminance (the brief). Source checks: the three shard commits between the
captures (`f81b2ed09` render/meshes/places/fireFx, `55a286313` `HD_GLOVE`, `1c872018f` `dunes.ts` WAVE/LEE/AMP_MAX and
`layout.ts` CRESTS). Commit `b3beecc14` (the late-dusk ground lift) landed after this capture and is not scored. Regions
are fractions of the portrait frame (x left → right, y top → bottom).

**Measurement hygiene first.** Round 6's coil is bigger (`HD_GLOVE` size 0.22 → 0.30) and bright orange, and it now sits
inside the patches every earlier round used for the ground (500×250 @40,1050 and the lower-left x 50–390, y 880–1350).
A bright orange coil on dark sand inflates any "ground spread" taken there. So this seat measures the sand on a clean
patch clear of the coil, Sefa and the HUD: **x 10–240, y 1150–1450** (x 0.01–0.31, y 0.68–0.86). Fine detail is mean
|luma − Gaussian-blurred luma| (σ 2 px).

## The measurements (mockup / r5 / r6)

| View | Clean sand luma, sd | Clean sand p5–p95 (spread) | p99 (crest / grain glints) | Fine detail | Clean sand RGB |
|---|---|---|---|---|---|
| dusk-fire | 72, 21 / 77, 13 / **56, 16** | 41–110 (69) / 56–94 (38) / **28–80 (52)** | 128 / 97 / **88** | 9.0 / 2.5 / **6.3** | 108,65,39 / 119,68,38 / 93,48,27 |
| A spawn | 56, 22 / 79, 14 / **60, 15** | 18–96 (78) / 56–96 (40) / **32–82 (50)** | 116 / 99 / **90** | 9.4 / 2.5 / **6.2** | 84,50,36 / 121,71,40 / 97,52,30 |
| B logbook | 39, 8 / 40, 12 / 46, 12 | 27–50 (23) / 19–59 (41) / 23–64 (41) | 56 / 67 / 71 | 2.2 / 4.3 / 4.7 | 60,34,28 / 61,35,30 / 71,40,33 |
| C waymark | 32, 7 / 21, 13 / **16, 8** | 23–38 (15) / 6–46 (40) / 6–25 (19) | 47 / 55 / 35 | 0.6 / 0.8 / 1.3 | 52,28,23 / 38,16,18 / **31,11,15** |
| D hands | 34, 11 / 31, 8 / **18, 9** | 17–49 (32) / 18–41 (23) / **6–30 (23)** | 53 / 43 / 36 | 0.8 / 0.8 / 2.2 | 50,31,28 / 51,26,27 / **34,14,18** |

The dune band, a 10-column luma grid (mean per cell; rows y 0.41–0.58 for dusk-fire, y 0.42–0.58 for A):

| View | Mockup | r5 | r6 |
|---|---|---|---|
| dusk-fire | shade face 28–39, lit slopes 80–88: range **~60** | shade 29–31, lit 65–86: ~57 | **39–66: ~27**, no cell below 39 or above 66 |
| A spawn | alternating rows 34–45 and 92–100: range **~66** | shade block 28–32, lit 64–79 | **40–75**, mostly 45–59 |

Other patches:
- **Coil (brightest 20 % of the coil region).** D: mockup 77,49,42 (luma 54, (R−B)/R 0.46) / r6 **94,47,26 (luma 56,
  (R−B)/R 0.72)** on a scene whose median is 20. A: mockup 138,84,58 (94) / r6 120,68,41 (77). The mockup's bright
  coil pixels are sheen on dark leather; the game's are the strand albedo itself, a saturated orange.
- **C flame (pixels over luma 150):** mockup 251,211,139 (214, p99 251) / r5 236,181,120 (188, p99 214) / r6
  **245,193,137 (200, p99 226)**. **C pool (x 0.15–0.55, y 0.52–0.62):** 56 / 44 / 49.
- **Sky patches** (500×300 @40,300): B 50 / 44 / 44, C 52 / 39 / 42, D 50 / 38 / 38 (luma): unchanged since round 5.

Reading:
- **The sand's grain is the round's one real gain.** Fine detail 2.5 → 6.2–6.3 in the two spawn views (mockups 9.0–9.4),
  and the near sand's mean fell from too bright (77–79) to the mockups' (A 60 vs 56). Under a 1.5× crop the ripples now
  break into lumpy ridges with grain, not sine corduroy.
- **The highlights still never come.** p99 88–90 against 116–128: no grazing-lit crest line, no glinting grain. The
  mean came down to the mockups' and the top did not go up, so the sand now reads as a matte mid-brown, not dusk light.
- **The big forms lost their light.** The shorter dune wave (72 m, crests 12 m) and the 3–8 m lower cameras turned the
  big lit/shade masses into small rolling hummocks. The dune band's range collapsed from ~57 to ~27 in dusk-fire. The
  tower dune no longer has a shade face at all. The mockups' most graphic device, a dark shaded dune against a lit
  slope, is gone from both spawn views.
- **The late views went dark and red.** C's and D's clean sand fell to 16 and 18 against 32 and 34, a maroon
  (31,11,15 / 34,14,18) where the mockups are a neutral brown-violet (52,28,23 / 50,31,28). The builder names this as
  known; `b3beecc14` came after the capture.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **5.5** | 1. **No shade mass (x 0–1, y 0.36–0.6).** The mockup's tower dune is a dark shaded dome (28–39) over a lit left slope (80–88), and a shaded saddle sweeps diagonally across the centre. Round 5 had a shade face; round 6 has none. The tower dune is a broad, evenly mid-lit mound, and the band is 39–66 everywhere. The rounded dome under the tower is now close to the mockup's silhouette. The sand grain is much better (detail 6.3 vs 9.0), but the lit sand has no bright crest (p99 88 vs 128). 2. **The coil (x 0.33–0.58, y 0.6–0.85).** It is now the mockup's size. But it is a bright orange-tan diamond mesh, the gaps near-black and the strands a flat saturated copper, so it reads as a woven net or snakeskin tube. The mockup's is a dark-brown leather plait whose strands catch a thin sheen. The glove is a smooth dark-grey mitt with no seams or creases. 3. **Sky (y 0.14–0.38).** Unchanged: pale peach flakes in diagonal rows edge to edge, against the mockup's open orange glow with a few grey-brown banks at the right. There is no ray and the lamp is unlit, and no far grey dune ranges, only a lavender mountain cut-out (x 0.6–0.9, y 0.36). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.5** | 1. **One dome, now flat-lit (x 0–1, y 0.34–0.6).** The mockup has four receding knife-edge crests, each lit to 92–100 beside a 34–45 shade face. The game has one tower dune filling the band, mostly 45–59 with no shade face; round 5's 28–32 shade block is gone too. The lower camera made the tower bigger and higher in the frame than the mockup's small, distant tower on the farthest crest. 2. **Foreground (y 0.6–0.86).** The mean now matches (60 vs 56) and the grain is real (6.2 vs 9.4). But the mockup's sand is grazing-lit: bold ripples with bright crests and black troughs (spread 78, p99 116). The game's is matte (spread 50, p99 90). 3. **Coil and sky.** The mockup's two big dark rings enter from the bottom edge. The game has one double loop of the same size at x 0.3–0.55, but in the orange net material. The sky is the same pale-flake band, with a pale-yellow horizon stripe where the mockup has small red-orange wisps lit from below. Sefa and her chip are the quest's real first step. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** | 1. **The wagon, unchanged (x 0.3–0.6, y 0.42–0.55).** The whole canvas is one even orange, self-lit with no falloff from the lantern. The lantern is a pale rectangle with no glow. The crates and sacks at the left (x 0.15–0.3) are black slabs. The tent is a flat grey sheet cut by the right edge, the horse is end-on, and the smoke is a straight thin ribbon. 2. **The coil (x 0.3–0.6, y 0.6–0.85).** It is bigger now, toward the mockup's big low rings, but a glowing orange net against the dim sand, where the mockup's rings are dark leather barely lifted from the ground. 3. **Ground and sky.** The sand is still too bright (46 vs 39) with broad diagonal bands; the sky is still plum (53,39,69 vs 49,46,92, luma 44 vs 50). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.0** | 1. **The fire has no fuel (x 0.3–0.42, y 0.36–0.50).** The Λ is gone, and the unlit bowl in `h3` no longer glows: the round-5 defect is fixed in both states. But the crown logs (`places.ts`: lean −1.15, length 0.26) lie so low that none shows. The bowl is an empty cup with flame sprites rising from its rim. The mockup's fire is a pile of burning logs, criss-crossed and glowing, inside the flame. The flame is brighter (luma 200 vs 214; was 188), but it is still smooth cream tongues with no ragged orange edge. The embers are a few white specks, not orange streaks sweeping up-left; the smoke is a soft column. 2. **The backdrop got worse (x 0–1, y 0.25–0.45).** The reshaped dunes put a dune wall across the whole background. The **next waymark, visible at x 0.83 in round 5, is now hidden behind it**: the mockup shows it on a low flat horizon with its "WAYMARK 64 M" chip and a warm afterglow behind. The game has no horizon glow here at all. The sky is 42 vs 52. 3. **Material and hand.** The plinth is clean new brick, not rough fieldstone, and the post is twisted copper, not sooty iron. The near sand is near-black maroon (16 vs 32). The coil is the orange net. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **4.5** | 1. **The composition broke (x 0–0.75, y 0.28–0.85).** The shorter dune wave put a dune's flank right in front of D's camera, which dropped 3.1 m. It now fills the left two-thirds of the frame, rising to y 0.29 at the left edge. The mockup's defining image is a flat, quiet horizon at y 0.53 with long parallel ridge bands. In the game the horizon is visible only at the right (x 0.6–1). The tower is buried deeper behind a second hump (x 0.78–0.85, y 0.40–0.45), and its "SIGNAL TOWER 197 M" chip sits over the cabin. 2. **The hero hand (x 0.45–1, y 0.55–0.85).** D is the close-up the mockup built for the whip and glove, and the material change hurts most here. The coil is a saturated orange net ((R−B)/R 0.72 vs 0.46) that glows against a scene whose median luma is 20. The mockup's is a dark plait with a crisp sheen on each strand. The glove is darker than round 5, a smooth grey-brown with no stitched panels, creases or lit seams. 3. **Ground and sky.** The sand is maroon and half the mockup's value (34,14,18, luma 18, vs 50,31,28, 34), whorled with ripples where the mockup's near sand is smooth. The sky patch is 38 vs 50, and the afterglow is a thin hot stripe, not a wide peach-pink band. |

**Seat score, Signal Dunes: (5.5 + 5.5 + 6.0 + 5.0 + 4.5) / 5 = 5.3** (this seat: round 1 4.6, round 2 5.1, round 3 4.9,
round 4 5.2, round 5 5.6).

The drop from 5.6 is D (5.5 → 4.5) and dusk-fire (6.0 → 5.5). Both come from the terrain reshape and the coil's new
material. The sand's grain gain lifts A and dusk-fire's foregrounds, but the bigger form and light losses cancel it.

## Builder's claims checked

| Claim (round-6 README) | Verdict | Evidence |
|---|---|---|
| dusk-fire spread 45 (mockup 62), fine detail 6.5 (8.5) | **Detail true; spread true only on a patch with the coil in it** | Clean sand: detail 6.3 vs 9.0, spread 52 vs 69. On the old lower-left patch, which now contains the coil, it is 44. |
| A spread 50 (79), fine 6.6 (7.2) | **True** | Clean sand: spread 50 vs 78, detail 6.2 vs 9.4. |
| D spread 45 (was 24; mockup 53) | **Not on the sand** | The standard ground patch now contains the bright orange coil: it reads 53, the mockup's number. Clean sand clear of the coil: **23 (round 5: 23; mockup 32)**. D's ground spread did not move; the coil moved into the patch. |
| Anisotropic grain, cm/mm octaves, noise-bent ripple crests, ripples on slip faces | **True, and visible** | 1.5× crops: broken lumpy ridges with grain. The largest material gain in six rounds. |
| Charred unlit logs, no glow when unlit, only their ends over the rim | **No glow: true. Ends over the rim: not in C** | h3's unlit bowl is dark. In C no log shows at all; the flame rises from an empty rim. |
| A brighter flame, half the light pool | **True** | Flame 200 (was 188; mockup 214). Pool 49 (was 44 on this patch; mockup 56). |
| The whip a crossing plait, the coil bigger and low | **Size true; finish wrong** | The coil is ~the mockups' size. The `meshes.ts` plait (`strand = 0.36,0.15,0.05 × (0.7 + 0.9·crown)`, gaps 0.03, roughness 0.85) renders as a saturated orange diamond net with black gaps and no sheen. |
| C and D ground a step darker than the mockups | **True, and larger than stated** | Clean sand: C 16 vs 32, D 18 vs 34, both a red maroon. |

## Findings, ranked by score gained

1. **Re-shape D's and C's ground back to a quiet horizon without losing the shorter wave elsewhere** (D x 0–0.75,
   y 0.28–0.85; C x 0–1, y 0.25–0.45). Evidence: D's left two-thirds is a dune flank, the tower buried behind a second
   hump; C's next waymark is now hidden. The mockups D and C are the shard's flat-pan views: long parallel bands under a
   low horizon. Fix: in `dunes.ts`, damp the wave's amplitude over the flat pan the waymark line crosses (the waymarks
   already have `PADS`; give the band between C's waymark, D's spot and the tower a wide low-amplitude ease, as the
   tower has its CRESTS entry). Then the bands read long and flat from D, the tower stands whole on the horizon, and the
   next waymark shows from C. Do it in the terrain, so it is true for every player walking there, never by moving a
   camera. Re-bake the terrain and navmesh, and walk 0 stuck.
2. **Give the whip leather, not netting** (all five, D first; x 0.3–0.75, y 0.58–0.86). Evidence: the coil's bright
   pixels are (R−B)/R 0.72 vs the mockup's 0.46, glowing at luma 56 on a scene median of 20 in D. Fix, in the
   `meshes.ts` plait block: drop the strand base toward the glove's dark brown (the mockup D coil ~70,42,37 at its
   brightest, most of it darker). Halve the pattern frequency (70 → ~35) so it reads as a few fat strands, not a fine
   mesh. Run the strands along the coil, not across a diamond grid: one strand set leaning +45° and one −45° relative
   to the cord's tangent, from the curve's own UV, not model-space xyz. Keep the gaps dark but not black. Bring the
   roughness down from 0.85 to ~0.45 on the strand crowns so each strand catches a thin sheen, which is where the
   mockups' bright pixels are. The glove: seams and creases as a normal map, base raised toward luma ~31 (D).
3. **Put the light back in the forms: shade faces and lit crests** (dusk-fire and A, y 0.34–0.62, then every view).
   Evidence: the band range ~27 (dusk-fire) against the mockup's ~60. No shade face; p99 88–90 vs 116–128. Fix: the
   shorter wave should keep at least one large dark lee face in each spawn view. The mockups' tower dune is shaded
   toward the camera, because the low sun sits behind and to the right of it. Check the key's azimuth against the
   tower dune's slope from the spawn (0, 13, 70): the lee faces must turn to the camera, as the mockups' do. Then
   sharpen the `N·L` response so slopes facing away fall to the 30s, and add a grazing crest term so ridge lines and
   ripple crests reach 110–125 while the field stays near 56–60. The mean is now right; the spread has to come from
   the top and the bottom, not the mean.
4. **Fuel in the brazier** (C, h4; x 0.3–0.42, y 0.38–0.48). The fix went from too high (Λ) to invisible. Fix: 6–8
   short logs criss-crossed so their upper third shows above the rim from eye height, and their tops sit inside the
   flame's base. Charred colour with glowing ends only when lit, as the builder already has; the unlit state stays dark.
   Then the flame's edge colour orange (the mockup's tongues are orange at the edges, white-yellow only at the core),
   embers as orange streaks drifting up-left, and the smoke widening.
5. **Neutralise the late-dusk sand** (C, D, B; y 0.6–0.86). Evidence: 31,11,15 and 34,14,18 vs 52,28,23 and 50,31,28.
   It is too red as well as too dark. `b3beecc14` lifts the value; the round-7 capture must also show the hue falling
   toward the mockups' neutral brown-violet ((R−B) ≈ 22–29, now ≈ 16 at a third of the value). B's sand goes the
   other way (46 vs 39) and needs the same check.
6. **The sky, still** (A, dusk-fire; y 0.12–0.40). Unchanged since round 5: confine the banks to a low band above the
   horizon and thin them, dusk-fire to a few grey-brown banks at the right, A to small red-orange wisps lit from below.
   Replace the flat lavender mountain cut-out with the mockups' layered grey dune ranges fading into haze. The clip
   shows the far range as stacked cut-outs with pale strips between them, and a hard-edged orange horizon band.
7. **The camp** (B; x 0.12–1, y 0.4–0.55). Still round 5's list: light falling off from the lantern (not a self-lit
   canvas), a lantern glow, light reaching the crates, the tent small and dark behind a side-on horse, the smoke
   widening.

## No-shortcut check (ledger 5)

- **Reshaped ground: global, not framed.** `dunes.ts` changes the one wave constant (WAVE 128 → 72, AMP_MAX 22 → 12)
  for the whole field. Both aerials show the shorter wave everywhere. `CRESTS` (tower dune lift 13 → 20, ease
  58 → 70) is one landmark dune, seen the same from the hero views (h1, h4) and the aerials. The reshape made two scored
  views worse (D, C), so it is not a shot-framing dodge. No breach. But the README's "no camera changed" hides that the
  views' framing changed a lot. From round 7 the README should show each mock view's frame from the previous round
  beside this one whenever a real camera moves more than 1 m.
- **Measured claims include the weapon.** The D ground-spread claim (45) is the coil inside the ground patch (clean
  sand: 23, unchanged). Not a shortcut in the image, but the number misleads the lead. Measure the sand on a patch
  clear of the viewmodel (this seat's x 0.01–0.31, y 0.68–0.86), or mask the viewmodel.
- **Staged state:** no staging commit; `meta.json` lists B, C and D as before. Reachability is as rounds 4–5 verified.
- **Frozen poses and dropped effects:** none. One `HD_GLOVE` constant, the same coil in h1–h4. C keeps its flame,
  embers, smoke and toasts.
- **A look only for the capture:** none. The grain, the plait, the logs and the dune wave are in the hero views, the
  aerials and the clip.
- **Painted stand-ins:** none in the playable area; the range and clouds are at infinity. The aerial-overview still
  shows soft dark blobs in the baked shadow (x 0.55–0.85, y 0.43–0.55), a look defect, not a breach.
- **Device and HUD:** 390×844 phone and touch, stored 780 wide, baseline HUD, 30 fps chip, 0 page errors.

SCORE signal-dunes: 5.3
