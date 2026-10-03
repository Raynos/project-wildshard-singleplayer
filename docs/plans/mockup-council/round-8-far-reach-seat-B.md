# Round 8, seat B, Sky Reach (Claude, lens: evidence, measured region by region)

Surface:
- The Sky Reach section of `art/mockup-council/round-8/README.md`, and the lead's proposal-B camera ruling in round 7's README.
- The five sheets `art/mockup-council/round-8/far-reach-*.jpg`.
- `progress/far-reach/20261003-0402-185b6810/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` (0.5 fps tiles), `meta.json`.
- Round 7's capture `20261003-0250-1c2c026e` for before and after.
- The five ledger mockups at full resolution.
- Source at `185b6810e`:
  - `species/stormRoc.ts` (stageLap, the state machine, PERCH), `plugin.ts` (the roc-lap stage), `layout.ts` (ROC, DAIS, PINES, STEP);
  - `world/skyIsles.ts` (2e2327f04), `art/far-reach/round-22-council-tools/measure.py` and `route-result.json`;
  - the commit messages of the nine shard commits between the captures.

Method:
- Every frame is resized to 780×1688. The same region (fractions of the frame, x left→right, y top→bottom, HUD included) is
  cut from the mockup, round 7 and round 8.
- On each patch I measured:
  - mean RGB and mean chroma (max−min);
  - Rec. 709 luminance p10 / p50 / p90, its standard deviation and the share above 230;
  - fine detail "hp": the standard deviation of luminance minus its own 3 px Gaussian blur.
- The sun is the brightest 12 px-blurred point, with a radial luminance profile round it.
- The Roc's span is read from the frame. Its colour is sampled on tight wing and body boxes, split into luminance bins.
- The patches are round 7 seat B's, so the two rounds compare directly. The sky patches now stop at x 0.38, clear of the
  quest tag (x 0.41–0.95, y 0.155–0.185), which darkened round 7's sky numbers.

## Measured (mockup / round 7 / round 8)

| Patch | Mockup | Round 7 | Round 8 | Reading |
|---|---|---|---|---|
| measure.py play rows: L p99; share > 230 (A / B / C / D / proposal B) | 238 / 240 / 236 / 241 / 239; 2.1 / 2.2 / 1.9 / 2.8 / 3.8 % | 239 / 238 / 239 / 241 / 242; 2.9 / 2.8 / 2.9 / 4.4 / 4.5 % | 238 / 235 / 237 / 238 / 239; **2.5 / 1.9 / 2.1 / 2.6 / 3.1 %** | now at or under the mockups in every view |
| A meadow x 0–0.6, y 0.66–0.84: mean; L p10/p50/p90; sd; hp | 91,73,36; 41/65/122; 34.1; 22.5 | 80,73,24; 56/71/87; 17.2; 8.4 | 88,73,29; **44/70/109; 27.2; 18.3** | **the mown lawn is gone**: about 80 % of the mockup's spread and detail |
| A subject band y 0.45–0.65, L p50; under the bridge x 0.25–0.75, y 0.53–0.6, p50 | 87; 108 | 74; 81 | **69; 77** | a little darker again (the gamma went) |
| A cluster zone x 0.05–0.95, y 0.17–0.36: L p10; sd | 105; 42.9 | 153; 29.4 | **120; 34.4** | part of the mass is back |
| A upper sky x 0.05–0.38, y 0.1–0.25: L p50; chroma | 184; 60 | 184; 56 | **172**; 56 | 12 darker |
| B lower left x 0–0.3, y 0.66–0.85: L p50 / p90; hp | 62 / 125; 21.5 | 63 / 93; 9.5 | **52 / 80; 7.9** | darker: the rock is now bigger and dark |
| B meadow x 0–0.45, y 0.58–0.66: hp; sd | 21.0; 44.2 | 16.0; 25.8 | **19.9; 29.2** | taller strands, closer |
| B rock top (mockup x 0.12–0.32, y 0.675–0.705; game x 0.05–0.3, y 0.69–0.72): L p50 / p90; hp; chroma | 99 / 161; 25.3; 63 | 74 / 98; 11.4; 60 | **55 / 81; 6.4; 37** | grey with lichen now, but half as bright and smooth |
| B upper-left sky x 0.05–0.45, y 0.22–0.34: L p10; sd | 140; 22.5 | 179; 23.2 | **113; 37.8** | **a crag now hangs there**; the mockup's is open cloud |
| C foreground x 0.05–0.65, y 0.77–0.85: mean; chroma; L p50 / p90; hp | 89,73,40; 49; 67 / 127; 22.4 | 99,94,27; 73; 90 / 125; 17.0 | **118,96,42; 76; 94 / 143; 23.1** | the detail matches; it is 27 brighter and much yellower |
| C upper sky x 0.05–0.38, y 0.1–0.25: mean; chroma; L p50 | 230,193,161; 70; 205 | 172,153,163; 37; 152 | **164,141,151; 40; 140** | **darker and still lavender** (regression of 12) |
| D storm x 0.05–0.65, y 0.09–0.25: L p50 / p90 | 87 / 158 | 83 / 136 | **70 / 123** | darker again |
| D middle band y 0.45–0.65 over 230; between the stones x 0.3–0.9, y 0.5–0.6 | 5.2 %; 3.3 % | 13.6 %; 12.6 % | **8.2 %; 8.7 %** | the halo is a third smaller; still 1.6–2.6× |
| D floor x 0–0.45, y 0.70–0.74, L p50; near meadow y 0.74–0.84: L p50, mean, chroma | 74; 55, 72,62,39, 35 | 50; 72, 84,79,22, 62 | **42; 92, 116,93,41, 75** | **inverted**: the mockup's floor is lit and its near grass dark; the game's floor is dark and its near grass bright straw |
| D Roc span (frame width); wing darks / mids | ~0.97; mids 101,88,96 (chroma 17) | ~0.68 frontal; 74,46,25 / 121,88,64 | **~0.59 side-on**; **60,37,25 / 124,91,70** (chroma 36 / 55) | banked now; smaller; **still warm brown**, not slate |
| Proposal B upper sky x 0.05–0.38, y 0.1–0.25: chroma; L p50 | 19; 176 | 102; 198 | **76; 179** | a quarter less orange; still four times the mockup's |
| Proposal B foreground x 0–0.45, y 0.62–0.84: L p90; hp | 154; 15.6 | 94; 11.3 | **93; 15.1** | the texture matches; the lit crest doesn't |
| Sun outer halo (r 70–110 px) A / D / proposal B | 168 / 213 / 191 | 198 / 225 / 221 | **180 / 217 / 208** | fainter, toward the mockups |
| Sun (x, y) A / B / C / D / proposal B | (0.34,0.35) / (1.0,0.42) / (0.05,0.34) / (0.23,0.46) / (0.24,0.40) | (0.28,0.38) / (0.40,0.39) / (0.43,0.46) / (0.29,0.45) / (0.28,0.30) | unchanged | B and C still far from their mockups' edges |
| Fan silk share of the frame (b > r+15, g > r+5), C | (mask catches mockup sky) | 5.3 % | 5.1 % | the hold is unchanged, as the README says |

## Scores

| Mockup | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.0** (r7 6.5) | 1. **The isle cluster (x 0.05–0.9, y 0.17–0.42) is only partly back.** One overlapping pair of crags (o1 / o3) hangs at the upper left (x 0–0.3, y 0.22–0.32), over and left of the sun. The mockup has four rooted crags spanning the mill, with the sun under them; over the mill the sky stays open cumulus. The cluster-zone p10 is 120, against the mockup's 105 and round 7's 153. 2. **The meadow (x 0–0.6, y 0.64–0.86) is a meadow again**: sd 27 vs 34, hp 18.3 vs 22.5 (round 7: 17 and 8.4). But it is a uniform olive-straw field with no daisies and no rocks; the mockup has three grey rocks at the lower left (x 0–0.35, y 0.7–0.85) and white and yellow flowers. 3. **The middle distance is dim (y 0.45–0.65).** The band p50 is 69 vs 87 and under the bridge 77 vs 108, both down 4–5 from round 7. The bridge's sides are open now (ties every 2.5 m), a gain. The mill is still a white stone tower where the mockup has timber and stone. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **6.5** (6.5) | 1. **The sky (x 0–1, y 0.15–0.45).** A new crag (o1, see finding 2) hangs at x 0.1–0.4, y 0.24–0.33, where the mockup has open lilac cloud (p10 113 vs 140). The sun is still at x 0.39; the mockup's floods in from the right edge. 2. **The lower left (x 0–0.4, y 0.64–0.86).** The rock is grey with lichen now (chroma 37), but it is a single large dark boulder filling x 0–0.38, y 0.66–0.78. The mockup has small lit stones in daisies. L p90 is 80 vs 125 and hp 6.4 vs 25.3. The strands above it are taller and closer (hp 19.9 vs 21). 3. **The keeper's set (x 0.05–0.45, y 0.43–0.62)** is unchanged: a stiff raised arm, and the book a pale sliver on a dark box where the mockup shows open pages. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **6.0** (6.0) | 1. **The sky (y 0.05–0.45) moved away.** The upper sky is darker and still cool: 164,141,151, p50 140, against the mockup's warm 230,193,161, p50 205 (round 7: 152). The sun is still at x 0.42 behind the mill, not at the left edge (x 0.05). The new crag at x 0.08–0.38, y 0.32–0.40 is bigger and nearer than the mockup's small isles at the edges. 2. **The foreground (x 0.05–0.65, y 0.77–0.86)** has the mockup's detail now (hp 23.1 vs 22.4). But it is a bright yellow straw (118,96,42, chroma 76, p50 94) against the mockup's darker olive (89,73,40, chroma 49, p50 67), with no rock at the lower left. 3. **The fan (x 0.3–1, y 0.5–0.82)** is unchanged: about half the mockup's leaf, upright at the right edge. The mockup sweeps it diagonally across the centre. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-lap`) | **6.5** (6.5) | 1. **The Roc (x 0.3–0.9, y 0.27–0.38)** banks now, but its silhouette moved away. It is side-on, flying right, its far wing hidden, spanning ~0.59 of the frame. The mockup's eagle comes at the camera three-quarter, both wings spread across ~0.97, talons forward. It is still brown: wing darks 60,37,25 and mids 124,91,70, against the mockup's slate mids 101,88,96 (chroma 17). 2. **The light (y 0.05–0.65).** The halo is a third smaller (8.2 % of the middle band over 230, mockup 5.2 %, round 7 13.6 %), a real gain. The storm got darker (p50 70 vs 87; round 7 83), and the gap between the stones is still a yellow wash rather than the mockup's cloud sea with isles. 3. **The arena floor (y 0.62–0.86) is inverted.** The mockup lights the ground round the dais (p50 74) and keeps the near grass dark with grey rocks and daisies (p50 55). The game has a dark band behind the dais (42) and a bright straw near field (92, chroma 75). Only one rock shows, a dark mound at the left edge (x 0–0.12, y 0.72–0.74). |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **6.0** (6.0) | Scored on what the fixed camera can match (the lead's ruling). 1. **The sky (y 0.05–0.5)** is a quarter less orange (upper chroma 76 vs round 7's 102), but still four times the mockup's pale air (19). The crag at the top left (x 0–0.3, y 0.12–0.25) matches the mockup's left isle in kind. 2. **The destination (x 0.1–0.9, y 0.25–0.55)** is still a wide flat shelf with five pines and a stone mill. The mockup has a narrow rooted spur, and the manta beside the mill. 3. **The foreground (x 0–1, y 0.55–0.86)** now has grass texture (hp 15.1 vs 15.6) and scattered mossy rocks. But it stays an unlit dark field (L p90 93 vs 154) where the mockup has a sunlit grass crest with daisies. |

**Seat score, Sky Reach: (7.0 + 6.5 + 6.0 + 6.5 + 6.0) / 5 = 6.4** (round 7, this seat: 6.3).

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Meadow: A patch L 49/72/110, spread 61, hp 13.4 vs mockup 40/61/105, 65, 12.4; round 7 spread 29, hp 8.5 | **The game numbers reproduce; the mockup's don't** | At 390 px on x 0–0.6, y 0.66–0.84: round 7 spread 29, round 8 47/70/106, spread 59. On the same patch the mockup is 42/66/117, spread 74, hp 16.9 (game 14.9). The game holds 80 % of the mockup's spread, not 94 %, and is still under it in detail. Quote the mockup from the same resample. |
| The Roc slate on emission and paint, 19 m span, a soar in a raised V, a 0.35 rad bank | **Bank and soar verified; slate not** | It banks and soars (side-on, wings raised). The wing darks are 60,37,25 (round 7: 74,46,25). Darker, but still warm brown: r − b = 35, while the mockup's mids have b ≥ r − 5. In this frame the 19 m span reads as 0.59 of the width, because the bird is side-on. |
| The fan's hold stays its size | **verified** | C silk 5.3 → 5.1 %; A 4.8 → 4.7 %. |
| The sun: halo fainter, D's middle band over 230 at 8 % | **verified** | 8.2 %; outer halo A 198 → 180, D 225 → 217, proposal B 221 → 208. "Warmer high" (fd20fba69) is **not** verified: C's zenith went darker and stayed lavender (152 → 140, chroma 37 → 40), and A's upper sky lost 12. |
| The dais rim fractured, the runes cut stone; D's rocks 10–13 m out, in frame | **Runes yes; rocks partly** | The spirals are pale incised marks now. One rock shows, a dark mound at x 0–0.12, y 0.72–0.74; the rest sink into the dark band behind the dais. |
| B's rocks rough grey with sparse lichen | **partly** | Grey-green with a lichen texture (chroma 60 → 37). But at p50 55 and hp 6.4 it is a dark smooth mass, three times the mockup rock's frame area. |
| The rises are grassed | **verified** | aerial-spawn: Sunrest's rise reads as sward now, no longer a bald dark dome (round 6 X1 closed). |
| Route evidence | **verified as filed** | `route-result.json`: updraft y 30.34 → 44.24 in 5.78 s, crown bridge y 44.00–44.03 in 16.22 s, `stuck: []` on both. |
| Luminance: top 1 % 235–239, 1.9–3.1 % over 230 | **verified** | p99 235.4–238.8; 1.9–3.1 %. |

## Ledger 5: the cameras, the staging and the flagged placement

- **Cameras.** camAt is identical to round 7 except D's eye (2 cm lower). The only `mock-*` change is D's stage and settle, as
  listed.
- **The A-cluster placement (2e2327f04): not a breach, but its premise is wrong in the numbers.**
  - It is one global layout of real 3D. The orbit clip and both aerials show o1 / o3 as ordinary isles in the archipelago,
    and no view hides them.
  - The commit and the README say B's and C's frames "start at −14.6 / −13.6", so the crags stay out of them. That is
    18.56° (the half-width of a 72° vertical FOV at 780/1688) minus B's and C's yaw, with the yaw's sign backwards.
  - B looks 4.0° left (dir x −0.07) and C 5.0° left (−0.087). Their left edges are at **22.6° and 23.6° left**.
  - o1 at (−30, −150) is 11.6° left from B and 13.4° left from C, so it projects to x ≈ 0.30 in B and 0.28 in C. That is
    exactly where the crag shows in both frames (B x 0.1–0.4, y 0.24–0.33; C x 0.08–0.38, y 0.32–0.40).
  - So the layout is not the "A only" composition it was placed as. It shows from every spawn view, and costs B its open
    upper-left sky.
  - Fair as world-building. But the trade the lead flagged is real, and it was decided on a wrong calculation.
- **The `roc-lap` stage: reachable, but not by the route the README gives. Should-fix, not void.**
  - `stageLap(−2.64)` puts the Roc on its 13 m lap at lap altitude, in the `rest` state. It circles at 10 m/s, so after
    1.5 s it is at θ ≈ −1.49, (1, −209). That is the lap's far (north) point, heading east and turning toward the
    camera, ~33 m out.
  - The README calls this "the 2.4 s rest every fight shows". From D's camera that rest can't produce this frame:
    - a phase-0 strike ends over the player (STOOP at p.y + 10);
    - the rest steers from there toward the lap point at 10 m/s;
    - so 1.5 s into a rest the Roc is at most ~15 m from a player standing at (0, −176), not 33 m out on the far side.
  - What a player at the arena's rise does see is the fight's **opening**. Fighting starts with `rest = 2` in `circle`,
    and the Roc leaves its PERCH on the tallest stone, opposite the entrance (the north side). It swings round the lap's
    north-east quarter toward the view, banking.
  - The frame matches that state. The pose is real flight with the real bank, held for seconds, not a freeze.
  - The θ was swept for the shot (2e2327f04: "tried −1.2 … −2.07"; now −2.64). That is choosing the moment of a moving
    bird, which I accept.
  - **Fix:** stage the real opening (the perch launch → its first lap, no teleport). Or name the stage for what it shows,
    so the next seat doesn't check the wrong path.
- **New regression in a hero view (no narrowing): h3 lost the high step.**
  - 9577ce703 added the windmill pine (−10.5, +1). From h3's camera (−3, −56) it stands 10.3 m away, 6° left of the
    view's axis. It now fills x 0.15–0.65 of h3 and hides the step isle, its waterfall and the updraft's foot (both shown
    in round 7).
  - The pine was placed "as mockup A clusters them". It moves no mock view's score.
  - It blocks the sightline to the next objective from the windmill isle's west rim.
- **Kept as before:** h4's `quest-crown` stage and the QUEST COMPLETE tracker in D; the phone tier and baseline HUD;
  0 page errors.

## Findings, ranked by score gained

1. **Repeated: the Roc's silhouette and colour** (D x 0–1, y 0.18–0.45).
   - **Evidence:** the span is ~0.59 side-on (round 7 ~0.68 frontal) against the mockup's ~0.97, three-quarter frontal
     with talons forward. The wing darks are 60,37,25 and the mids 124,91,70 (chroma 36–55), against the mockup's slate
     101,88,96 (chroma 17).
   - **Fix:**
     - Trace why the slate never reaches the pixels. Measure the wing albedo with the sun's back-light off; if it is
       brown there too, the vertex colours (`rust` / `brown` / `dusk` in the palette) are overriding `slate`.
     - Use the opening lap's real moment when the bird turns *toward* the camera: both wings show and it is banked.
       The mockup's pose is the stalk/turn-in, not the side-on pass.
     - Bring the talons forward in that phase.
2. **New (the flagged placement): the A crags show in B, C and proposal B** (B x 0.1–0.4, y 0.24–0.33; C x 0.08–0.38,
   y 0.32–0.40).
   - **Evidence:** the frame-edge sign error above. B's left edge is 22.6° left, not 14.6°.
   - **Fix:** if the cluster is to serve A only, it has to sit past 22.6° left from B and 23.6° from C. Those headings
     are outside A's ±18.6°, so no single placement serves A without entering B and C.
   - So the lead rules the trade. Either A's cluster, over the mill and wider (A's biggest open gap), or B's open sky.
     Then place it once, with the corrected numbers, and check all five views and h1 / h2.
3. **New, partly a regression: the sky's upper half moved darker** (C and A, x 0.05–0.38, y 0.1–0.25; D's storm
   y 0.09–0.25).
   - **Evidence:** C's zenith p50 152 → 140 against 205, still lavender (164,141,151 vs 230,193,161). A 184 → 172
     (mockup 184). D's storm 83 → 70 (87).
   - **Fix:** warm and lift the dome above ~30° on the sun's side, toward the mockups' 220,182,160. The README's "warmer
     high" did not land. Keep proposal B's chroma falling: 76 now, against 19.
4. **New: D's ground tones are inverted, and C's verge is straw** (D x 0–1, y 0.62–0.86; C x 0.05–0.65, y 0.77–0.86).
   - **Evidence:**
     - D floor p50 42 vs 74, near field 92 vs 55 (chroma 75 vs 35).
     - C foreground 118,96,42, chroma 76, against 89,73,40, chroma 49.
   - **Fix:**
     - Light the sward round the dais (its roots and the shade floor there).
     - Take the near tall strands toward the mockups' darker olive-green. The bright straw is the lit-strand ramp seen
       against the low sun.
     - Bring D's rocks up out of the dark band.
5. **Repeated: the rocks the mockups show** (A x 0–0.35, y 0.7–0.85, none; B x 0–0.38, y 0.66–0.78, one oversized dark
   boulder).
   - **Evidence:** B rock p50 55 / p90 81, hp 6.4, against 99 / 161 and 25.3.
   - **Fix:**
     - B: smaller stones with a lit top face, sitting in the flowers.
     - A: the three grey rocks at its lower left. Real, walkable placement; check that no walk crosses them.
6. **New: h3's high step is hidden by the moved windmill pine** (h3 x 0.15–0.65; 9577ce703, pine (−10.5, +1)).
   - **Fix:** move that pine 2–3 m east or south. A's cluster of three left of the mill still reads from the spawn, and
     the step and updraft stay visible from the isle's west rim.
7. **Repeated: the sun's side and the subjects' forms.**
   - The sun is at x 0.39 in B (mockup at the right edge) and x 0.42 in C (mockup x 0.05).
   - The mill is a white stone tower.
   - B's book is a sliver.
   - C's fan is half the mockup's leaf.
   - Proposal B's destination is a wide shelf.
   - All unchanged this round.
8. **Repeated: A's middle distance is dim** (A y 0.45–0.65).
   - **Evidence:** band p50 69 vs 87, under the bridge 77 vs 108, both down 4–5 since round 7.
   - **Fix:** lift the bridge-and-isle band locally (the back-lit rim and the cloud under the keel), not by a global
     gamma. Re-measure A's meadow after it.

SCORE sky-reach: 6.4
