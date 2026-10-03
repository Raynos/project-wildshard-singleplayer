# Round 8, seat C (Claude, red team), Signal Dunes

Surface: the "Signal Dunes, round 8" section of `art/mockup-council/round-8/README.md` and its five sheets; the full-res
frames in `progress/sunscar-dunes/20261003-0322-0cd1ecbb/` (every `mock-*`, h1–h4, both aerials, `clip.mp4` at 0.5 fps,
`meta.json`); round 7's `20261003-0156-eeee0e02/` for before and after; the five ledger mockups at full resolution, scaled
to 780×1688. I built mockup | r7 | r8 triptychs per view and per region. Source checks are at the capture's commit
`0cd1ecbb` (`git show`): `551e484de`, `4c79afef0`, `fd2ad32c0`, `c36bd9425` and `96c73ea36` (the staging), plus the baked
`terrain.bin` decoded and sampled with the engine's bilinear `heightAt`. All brightness is Rec. 709 luma. Clean sand is
the seats' patch **x 10–240, y 1150–1450**, and fine detail is mean |luma − Gaussian-blurred luma| (σ 2 px). Regions are
fractions of the portrait frame (x left → right, y top → bottom).

**The short version.** This is the first round since round 5 with real gains that I can see:
- the coil is a true plait in every view;
- the vertical terminator smear is gone;
- the near grain matches dusk-fire's;
- the flame is orange;
- B's sand and sky are on target;
- D's horizon is right.

Three things cut against that:
- B's re-aim turned the camera the wrong way, which breaks the view rule (ledger 5);
- the bluer dome clips C's and D's zenith to an electric blue with no red in it;
- the shapes that make each mockup are still missing: A's receding crests, the sky's low banks, C's open horizon and
  big fire, the camp's lit cargo.

## The measurements (mockup / r7 / r8)

| View | Clean sand mean | Spread p95−p5 | p99 | Fine detail | Clean sand RGB (mockup / r8) |
|---|---|---|---|---|---|
| dusk-fire | 72.0 / 74.9 / **68.2** | 69 / 50 / **83** | 128 / 100 / **109** | 9.0 / 4.1 / **9.3** | 108,65,39 / 103,61,38 |
| A spawn | 56.2 / 76.8 / **70.5** | 78 / 47 / **90** | 116 / 102 / **117** | 9.3 / 3.9 / **12.6** | 84,50,36 / 105,63,40 |
| B logbook | 39.0 / 46.9 / **38.2** | 23 / 42 / **32** | 56 / 72 / **58** | 2.2 / 4.8 / **3.4** | 60,34,28 / 60,33,28 |
| C waymark | 32.4 / 18.0 / **40.2** | 15 / 26 / **39** | 47 / 37 / **63** | 0.6 / 1.4 / **1.9** | 52,28,23 / 64,34,30 |
| D hands | 34.5 / 31.2 / **38.1** | 32 / 24 / **31** | 53 / 44 / **55** | 0.8 / 1.1 / **2.0** | 50,31,28 / 57,33,30 |

The builder's round-8 numbers reproduce on this patch: dusk-fire 68.2 / 9.3, A 70.5 / 12.6, B 38.2, C 40.0, D 38.1. This
is the first round where they do.

Other regions:
- **Sky box (40,300)–(540,600), mean luma (RGB):**

  | View | Mockup | r7 | r8 |
  |---|---|---|---|
  | A | 88 (133,77,69) | 82 | **114 (159,104,87)** |
  | dusk-fire | 76 | 90 | **96** |
  | B | 50 (49,46,92) | 44 | **49 (51,45,79)** |
  | C | 53 | 40 | **50** |
  | D | 50 | 38 | **41** |

- **Zenith, (250,170)–(450,205), RGB:**

  | View | Mockup | r7 | r8 |
  |---|---|---|---|
  | D | 18,23,60 | 27,30,75 | **0,22,97** (R is 0 on every pixel) |
  | C | 22,26,62 | 30,29,64 | **51,52,91** (R min 0) |
  | B | 21,28,67 | — | **28,31,74** |

- **D's afterglow, column x 300–500.** The mockup peaks at 146 at y 0.50, with 118 at 0.45, coloured 182,138,117. Round 8
  peaks at 140 at y 0.50 but has only 87 at 0.45, coloured **207,127,64**. That is a thin band of saturated orange
  where the mockup has a broad peach one.
- **The dune band, dusk-fire** (10 column cells):
  - Round 8: at y 0.44–0.48 the tower dune's face is an even 32–37; at y 0.52 the left lit block is 74–78 beside
    31–46 shade.
  - The mockup's shade is 42–49 against a lit left block of 78–94. Round 7 had 23–26 with the lit flank on the
    *right*.
- **The dune band, A:**
  - Round 8: the dome is 31–43 across the full width at y 0.40–0.44.
  - The mockup has lit diagonal crests at 93–113 (y 0.40–0.44, x 0.3–0.6) inside 35–47 shade.
- **C flame** (box x 150–450, y 350–900):

  | | Mockup | r7 | r8 |
  |---|---|---|---|
  | Pixels over luma 150 | 13 733 | 15 006 | **7 662** |
  | Mean of those pixels | 213 | 200 | **181** |
  | Saturated orange (R>180, G<150, B<90) | 8 441 | 2 291 | **7 202** |
  | White-hot (luma > 235) | 4 649 | 307 | **420** |
  | Pool (x 150–450, y 1060–1150) | 40 (69,33,23) | 52 | **64 (103,55,35)** |

- **D glove back** (the matching region of each frame):

  | | Mockup | r7 | r8 |
  |---|---|---|---|
  | p95 | 80 | 43 | **55** |
  | p99 | 115 | 53 | **63** |
  | Fine detail | 8.6 | 2.1 | **2.9** |

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.5** | 1. **The sky (x 0–1, y 0.10–0.38).** Round 7's pale flakes are now ~20 red-brown diagonal smears scattered evenly over the whole upper sky. The mockup is open amber sky with one grey-brown bank at the right only, and the ray. The box is 96 against 76: too bright, too busy. 2. **The shade's shape (x 0–1, y 0.40–0.60).** The smear is gone and the dome's face is now evenly in shade (32–37 against 42–49). But the mockup's shade sweeps *diagonally* from the tower's foot to the lower right over a bright raked left shoulder (78–94). The game's shade is a near-horizontal band across the saddle, and there is no visible lit crest line on the dome. 3. **The coil (x 0.33–0.75, y 0.56–0.82).** It is a real plait now, the round's biggest gain. But it is two near-coincident vertical rings held up at the centre. The mockup has one loose diagonal loop held low-left, with a creased glove (here p95 55 vs 80, smooth mottle). The grain matches (9.3 vs 9.0) and the keeper's lamp burns as the mockup's does. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.0** | 1. **One dome, not receding crests (x 0–1, y 0.34–0.60).** The dome's camera face is now one even dark mass (31–43). The mockup's three or four diagonal knife-edge crests (lit 93–113) recede to a small tower; the game's tower stands about 1.5× taller on its single dome. 2. **The near sand (y 0.6–0.86).** It is still 14 too bright (70.5 vs 56.2; RGB 105,63,40 vs 84,50,36). The grain now overshoots: 12.6 vs 9.3, a crunchy stucco where the mockup has ripple troughs with glinting crowns. 3. **The sky (y 0.10–0.34).** It is brighter than the mockup (114 vs 88), with red-brown smears up to the HUD. The mockup has red-orange broken banks low over the horizon, left and right, with open blue-violet above. The horizon height now matches (re-aim verified: the mockup's ranges at y 0.343, the game's at ~0.35). |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** (diagnostic: view-rule breach, see the audit) | 1. **The framing (x 0–1, y 0.40–0.56).** The re-aim moved the camp the wrong way. The wagon spans x 0.20–0.47 with its lantern at 0.29, against the mockup's 0.41–0.69 with the lantern at 0.52 (round 7: 0.36–0.61, lantern 0.44). The crosshair sits on the cookfire, and the cargo is pushed to x 0–0.15 under the HOVER button. 2. **The camp's materials (x 0.15–0.95, y 0.42–0.55).** The canvas is no longer blown, but it is now a blotchy cream-and-brown camouflage, not the mockup's torn pale cloth. The lantern is still a small pale rectangle with no glow on the cargo, and the crates and sacks are still black slabs. The horse is side-on and the tent is smaller (gains). 3. **The ground and the coil.** The sand is on target (38.2 vs 39.0, RGB 60,33,28 vs 60,34,28) and the sky close (51,45,79 vs 49,46,92), with fewer stars. The plait coil is a raised double ring at x 0.30–0.65, where the mockup's two big rings rise from the bottom edge across x 0.33–0.85. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.0** | 1. **The fire (x 0.28–0.47, y 0.30–0.50).** The tongues are orange now (7 202 saturated pixels vs 8 441; round 7 2 291) with torn edges and dark logs. But the flame is half the mockup's size (7 662 bright pixels vs 13 733) and has no white-hot core (420 vs 4 649). The embers and plume drift **up-right** (the world `WIND` blows right in this view): the mockup's go up-left. The plume is a pale glowing column, not dark billowing smoke. 2. **The backdrop (x 0–1, y 0.25–0.45).** A dark dune face still fills the sky behind the bowl. The mockup has the bowl against open sky over a flat horizon at y ~0.5. The next waymark burns at the right, as in the mockup. 3. **Materials and light (y 0.45–0.86).** Clean brick plinth and twisted copper post, against fieldstone and sooty iron. The fire's sand light overshoots: the pool is 64 vs 40, yellow-orange where the mockup's is deep orange, and the clean patch is 40 vs 32 (round 7: 18, too dark). The zenith turned a clipped blue (R min 0). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.0** | 1. **The landform and the tower (x 0–1, y 0.48–0.65).** The 88 m move gives the right horizon (y ~0.51) and the tower at x 0.83, which is closer than round 7. But the near right is still a big rising dune slope (x 0.55–1, y 0.52–0.62), not the mockup's long flat dark bands. The ground is mid-brown and low in contrast, where the mockup's bands are near-black (12–26 at y 0.52–0.56). The tower's base is behind its own dune (terrain 0.75° above its foot) and the chip covers its top. The waymark fire the mockup shows at the far left is hidden by a ridge; only its embers show. 2. **The sky (y 0.05–0.50).** The zenith is an electric blue with no red at all (0,22,97 vs 18,23,60), a regression from round 7's 27,30,75, with a dithered speckle band and fainter stars. The afterglow is a thin saturated orange stripe (207,127,64), not the mockup's broad peach-pink band (182,138,117). 3. **The hero hand (x 0.40–1, y 0.55–0.86).** The plait reads at last, with chevrons and dark creases. But the loop is a perfect circle of even strands with no sheen on the crowns, against the mockup's tall loose loops whose strands each catch a rim. The glove lost the zipper and gained a soft mottle (fine 2.9 vs 8.6, p95 55 vs 80), with no crackle, knuckle creases or bright worn edges, and the fingers are still beads. |

**Seat score, Signal Dunes: (6.5 + 6.0 + 6.0 + 6.0 + 6.0) / 5 = 6.1.** This seat's earlier scores: 4.6, 5.1, 4.9, 5.2,
5.6, 5.3, 5.7.

## Builder's claims checked

| Claim | Verdict | Evidence |
|---|---|---|
| Clean-patch numbers (c36bd9425) | **True** | All five reproduce to within 0.2. |
| The vertical terminator smear is gone; the dune's camera face in shade "under a lit crest" | **Smear: true. Lit crest: not visible** | dusk-fire, A, h1 and aerial-spawn show the dome's face evenly shaded and following the dome. At 780 px no crest line is brighter than the sky behind it. |
| B: "turned 5.5° right, the wagon centred on the crosshair as the mockup frames it, the crates left" | **False** | The lantern is at x 0.29 (mockup 0.52; round 7 0.44). The wagon spans 0.20–0.47 (mockup 0.41–0.69). The crosshair is on the cookfire. Turning right moves the subject left, and the mockup needed it ~3° *left* of round 7. |
| Embers "as orange dashes blowing up-left" | **Dash tilt only** | `fireFx.ts` draws each point as a dash at a fixed screen angle (`gl_PointCoord`, dir −0.55, −0.83), so every ember leans up-left on screen whatever its motion. Their drift follows `WIND` (−0.643, 0.766), which in C's view carries them and the plume up-right. |
| Flame "saturated orange … a white-hot core over the logs" | **Orange: true. Core: no** | 7 202 vs 8 441 saturated pixels; 420 vs 4 649 white-hot. The flame is half the mockup's bright area. |
| Sky: "broken horizontal wisps 6–17° up, red-orange bellies … a bluer dome" | **Colour: true. Form: no. Side effect: regression** | The wisps are diagonal smears at even spacing over the whole upper sky. B's dome is on target, but C's and D's zeniths clip red to 0. |
| D: an overlook, horizon ~0.51, tower whole at x ~0.85; ground 25.7 m; everything in frame ≥1.6° under the eye | **Mostly true** | Horizon ~0.51, tower x 0.83. Ground 25.57 m (bilinear on the baked grid; the local maximum is 25.79 m, 4 m away). The highest terrain in frame is at −1.44° (the tower dune's crest at 193 m). The tower is not whole: its foot is 0.75° under that crest. |
| Plaited coil with true UVs | **True** | `whipModel.ts plaitedCoil`: the tile is in cord space, and the chevrons read in all five views and in h1–h4. |
| The gauntlet's crinkle, roughness 0.42 | **Partly** | The zipper is gone. The finish is a soft mottle: fine 2.9 vs 8.6, p95 55 vs 80. |
| Terrain unchanged from round 7 | **True** | `terrain.json` hash d5c0efe9 at both captures; `dunes.ts` and `layout.ts` have no net diff; the real cameras for dusk-fire and C are identical. |

## Findings, ranked by score gained

1. **The sky's form, and the zenith regression** (A, dusk-fire, C, D; y 0.05–0.40). *Repeated (form); regression (zenith).*
   - The cloud deck: keep the red-orange bellies, but lay the wisps horizontal and low, 2–10° above the horizon.
     - A: in two broken banks, left and right of the glow.
     - dusk-fire: one grey-brown bank at the right only.
     - Leave the upper sky open.
   - The A and dusk-fire sky boxes are 96–114 against 76–88: take the rose-peach lift above the band back down.
   - The dome tint that put B at 51,45,79 must not drive red to zero:
     - clamp the dome's red at the mockups' ~18–22 at the zenith in C and D;
     - remove the dithered speckle band in D;
     - bring the stars back to the mockups' crisp white points.
   - D's afterglow: widen it to a band from y ~0.44 to 0.51 and shift its hue from 207,127,64 toward 182,138,117.
2. **Re-capture B at the mockup's framing** (B; x 0–1, y 0.40–0.56). *New, ledger 5.*
   - Set `mock-B-logbook` yaw ≈ 57, which puts the lantern at x 0.52. At round 8's yaw 48.3 the lantern sits 8.1° left
     of centre and the mockup's is 0.8° right, so the turn is ~8.8° left. From round 7 (yaw 53.8, lantern 0.44) the
     same sum gives 56.7.
   - Then fix the camp in that frame:
     - the lantern a visible glow whose light falls on the tailboard, crates and sacks;
     - the crates with boards and lit faces, not black slabs;
     - the cloth an even pale weathered tone with tears, not camouflage patches.
3. **A's receding crests** (A, and dusk-fire's left shoulder; x 0–1, y 0.34–0.60). *Repeated since round 1.*
   - The single dome is the largest remaining difference in Jake's two spawn views. Between the spawn and the tower,
     the mockup shows two or three diagonal crests: lit on their sun side, shaded on the camera side, each lower and
     farther than the last.
   - Build them as global terrain (the `CRESTS` / dune phase in `layout.ts` and `dunes.ts`, re-baked, with the climb
     test), never per shot. Then check them from h1 and the aerials.
   - The builder's later `8a6b91e24` (a broader, lower tower dune) is the start of this; it is not in this capture.
4. **The fire** (C, every lit brazier; x 0.25–0.50, y 0.20–0.50). *Repeated, partly fixed.*
   - Double the flame's height and width, and put a white-yellow core low over the logs (target ~4 600 pixels over
     luma 235).
   - Drive the ember dash's direction from each particle's projected velocity, not a fixed `gl_PointCoord` angle.
   - Make the plume dark brown billowing smoke that is lit only at its foot, not a pale column.
   - C's drift is mirrored from the mockup's. The world wind is the world's, so leave it. Match the rest instead.
   - Pull the sand light back: pool to ~40 luma, deep orange (69,33,23); C's clean patch to ~32.
5. **The hero hand** (D, and all; x 0.33–1, y 0.55–0.86). *Repeated, partly fixed.*
   - The coil:
     - two tall, loose, slightly separated loops (the mockup's D) rather than a near-perfect circle;
     - in A and B, larger rings that enter from the bottom edge;
     - a sheen on each strand's crown on the key side (p99 near the mockup's ~140, against flat crowns now).
   - The glove:
     - crackle and knuckle creases as a normal or detail map at hand scale, not a fine mottle;
     - worn highlights up to luma ~80–115 (now 55 / 63);
     - fingers with joints instead of beads.
6. **A's near sand** (A, y 0.6–0.86). *Repeated.*
   - The mean is 70.5 vs 56.2. Lower A's lit-slope response toward 84,50,36 without touching dusk-fire (on target at
     68 vs 72).
   - Fine detail now overshoots (12.6 vs 9.3): cut the 1 cm clump octave's amplitude by about a quarter. Leave the
     ripple troughs.
7. **C's backdrop** (C, x 0–1, y 0.25–0.45). *Repeated since round 3.* The bowl stands against a dark dune face. The
   mockup's brazier stands on the flat with sky behind it. Move the waymark (layout, real geometry) to where the land
   behind it falls away, or lower the dune behind it globally. Never re-aim the camera to get it.

## Ledger-5 audit

- **D's 88 m move: no breach.**
  - Walkable: the ground at (38, 122) is 25.57 m and slopes 6.7°. A straight walk from the spawn rises 5.9 m over 64 m,
    with no slope over 17.7° (the limit is 40°). It is inside `PLAY_HALF` 200, and the eye is 1.70 m, as in every
    other view.
  - It hides nothing I can find. The highest terrain in frame is the tower dune's crest at −1.44°. Every waymark is
    157 m or more away: the one in frame is hidden behind a ridge (fire at −8.6°, ridge at −6.1°), and that loses a
    detail the mockup shows rather than gaining one.
  - Red-team note: the spot is off every trail, 52 m behind the spawn. At this quest step a player stands there only by
    walking ~160 m away from the objective. It is reachable, and it is the one spot on the map that frames this
    mockup.
  - Cost to the score: D's gain is composition only. The flat parallel bands of the mockup's land exist nowhere in the
    shard. I score the frame, not the search.
- **B's re-aim: breach of the view rule.**
  - The ledger allows a re-aim "only to match its mockup's camera better". This one moved the subject 0.15 of the frame
    *away* from the mockup (the lantern from 0.44 to 0.29, against 0.52).
  - It pushed the cargo, called black slabs by every seat since round 5, to x 0–0.15, half under the HOVER button.
  - It brought the new side-on horse and tent into frame.
  - The README claim is false.
  - I score B as diagnostic (6.0, as captured, with the composition loss counted). Re-capture B at yaw ≈ 57 before any
    pass counts. It does not change this round's outcome.
- **A's re-aim: supported.** The mockup's far ranges sit at y 0.343; the game's sit at ~0.35.
- **Staging (`96c73ea36`): no breach.**
  - The stage lights the far waymark (34, −102) last, while C's camera stands 11 m from (−44, −22).
  - The quest counts the waymarks in any order (`done: { all }`). The whip's reach is 7–8 m. `duskOf` depends only on
    how many are lit.
  - So a player who lights (−44, −22) last and steps back 3–4 m in 3 s sees this frame.
  - D's 11 s settle shows no toasts. Its frame is the settled state a player reaches by walking there.
- **Terrain: no breach.** Part 1's flats were removed in part 2. The hash is round 7's, and dusk-fire's and C's real
  cameras are unchanged.
- **Look tuned for the views: none that breaks the ledger.** Two global choices favour the mockups and should be watched:
  - The near grain and the ripples' contrast fade as the dusk deepens. This is quest state, so it is real, and the
    clip's late-dusk ground is flatter for it.
  - The ember dash leans at a fixed screen angle (finding 4).
  - Neither is a card or an overlay.
- **Device and HUD: no breach.** 390×844 phone and touch, stored 780 wide; the baseline HUD in every view; the 30 fps
  chip; `active: []`; page errors 0. The phone GPU ceiling is 108.99 MB, inside 1.8 / 1.0 GB. This surface has no
  frame-time trace: unverified, not breached.

SCORE signal-dunes: 6.1
