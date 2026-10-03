# Round 14, seat C, Sky Reach (Claude, lens: red team)

2026-10-03. The bar is 7.0 (ledger 4 as Jake amended it). The bar doesn't change how I score.

Surface:
- The Sky Reach section of `art/mockup-council/round-14/README.md` and the five sheets.
- `progress/far-reach/20261003-0823-ce11353e/`: all 12 frames, `clip.mp4` (1 fps tiles) and `meta.json`.
- Round 13's capture `20261003-0719-8512344b`: every frame side by side with a per-band pixel diff, both clips tiled.
- The five ledger mockups at full resolution, `art/far-reach/round-31-roc-fix/` (README and board) and row 5 of
  `project/archive/2026-10-03-sky-reach-top10.md`.
- `git show` of 3000a8b71 (cumulus banks), 7119cb4ae (keels, meadow shade, o3) and 8138fabd4 (the Roc). I read
  `look/puffs.ts`, `look/render.ts` (`cloudBanks`, `keelPuffs`), `world/skyIsleHd.ts`, `world/isle.ts`,
  `species/stormRoc.ts` and `species/rig.ts` (`yawTo`).
- I ran the shard's own code offline (node, `scripts/bake-loader.mjs`, read-only):
  - `cloudBanks()`, to place all 48 banks and test the sun disc from every playable island;
  - `crownStones()` and `FALLEN_BRIDGE`, to replay the Roc's take-off lean from D's spot and from the bridge landing.

Method:
- Every image is resized to 780×1688 (Lanczos).
- Brightness is Rec. 709 luminance (L). "hot" is the share of L > 230. "hp" is the standard deviation of L minus its 3 px
  Gaussian blur. "white" is the share with L > 170 and chroma (max−min RGB) < 60.
- Regions are frame fractions (x left→right, y top→bottom). They are round 13's regions, so the numbers compare.
- Cells read mockup / round 13 / round 14.
- The lead's rulings apply:
  - the cluster over the mill is scored on its finish in B, C and P;
  - proposal B's sky is scored on finish, not saturation.

## What changed since round 13

- **Meta:** the `cameras` blob and every `camAt` are identical. Staging is unchanged (`roc-opening` on D, `quest-crown` on
  h4). `retaken` is empty, every shot is `world`, `programs` is 102 and there are no page errors. Both captures are
  LUT-off, so they compare like for like.
- **The pixels:** 7–26 % of each frame changed by more than 12 levels (round 13: 28–49 %).
  - The changes are D's Roc (83 % of the y .30–.40 band), the playable keels (A, B, C, P, the aerials, the clip) and a
    few new cumulus puffs round the cluster and the mill.
  - The sky above y ≈ 0.20 is unchanged in every first-person view. **C's upper sky is pixel-identical for the third
    round:** 151.7 against 205.2, sd 3.1 against 10.9.
  - The foregrounds of B and C are pixel-identical (B near ground 60.8 / 122.3 / 32.5 both rounds).

## Measured (mockup / round 13 / round 14)

| Patch | Mockup | R13 | R14 | Reading |
|---|---|---|---|---|
| A near ground x .03–.32, y .68–.82: p50; p90; sd; hp | 59; 100; 29.7; 19.9 | 53; 106; 32.9; 21.6 | 55; 106; 32.9; 21.6 | unchanged |
| A nearest band x 0–.36, y .76–.84: p50 | 56 | 46 | **46** | the "one constant shade" moved it by 0.4 |
| A mid meadow x 0–.45, y .58–.68: p50; p90 | 88; 162 | 58; 127 | 59; **143** | highlights closer |
| A cluster band y .22–.36: p50; chroma | 174; 80 | 157; 74 | 164; 74 | slightly brighter (new puffs) |
| A under the cluster y .36–.46: hot | 5.2 % | 15.6 % | 16.4 % | still 3× |
| A behind the posts x .30–.70, y .47–.60: p50 | 98 | 82 | **73** | **darker**: the green bun is gone, and the flat lavender cloud sea shows instead (finding 2) |
| A right of the bridge x .62–.80, y .47–.60: p50 | 79 | 82 | **63** | the same cause |
| B sky band y .20–.40: p50; white | 171; 13.8 % | 167; 9.4 % | 170; 10.0 % | a little more cloud |
| C upper sky x .05–.38, y .10–.25: p50; chroma | 205; 70 | 152; 35 | **152; 35** | pixel-identical |
| C top band x .20–.60, y .04–.09: sd | 10.9 | 3.1 | **3.1** | pixel-identical |
| D sun patch x .05–.45, y .44–.50: hot | 36.8 % | 3.2 % | **20.3 %** | the sun is back (the builder's 20.4 reproduces) |
| D sun-disc row, left half y .40–.52: share L > 245 | 7.0 % | 0.1 % | **2.5 %** | reproduces |
| D between the stones x .30–.50, y .50–.60: chroma; white | 71; 8.0 % | 109; 0.4 % | 106; **0.4 %** | unchanged: no cloud tops in the gap (finding 4) |
| D storm x .05–.65, y .09–.25: p50; chroma | 87; 25 | 70; 35 | 70; 35 | unchanged |
| D stones band y .53–.62: p50; hp | 128; 24.4 | 120; 15.1 | 120; 15.1 | unchanged |
| D whole play y .05–.85: hot | 2.9 % | 0.4 % | 1.1 % | from the sun alone (h4's sun is unchanged, so the cause is not global) |
| P crest x 0–.36, y .62–.84: p50; p90; sd; white | 69; 159; 46.4; 4.7 % | 53; 108; 29.9; 0 | 53; 108; 29.9; 0 | unchanged |
| P under the mill deck x .55–.90, y .40–.50: p50; white | 180; 16.4 % | 104; 2.0 % | **134; 4.5 %** | closer: the bun is gone |
| P ray zone x .42–.75, y .29–.47: white | 31.7 % | 0.4 % | 1.0 % | no ray, for the fourth round |
| p99, rows y .071–.828 (A / P / B / C / D) | 239.3 / 239.1 / 241.6 / 237.0 / 243.0 | 238.9 / 237.8 / 235.6 / 239.2 / 223.1 | 239.6 / 239.5 / 237.2 / 240.7 / 232.5 | the README's top-1 % figures reproduce within about 1 L |
| Teal fan pixels, share of y 0–.85 (A / B / C / D / P) | 1.5 / 2.6 / 5.0 / 0.5 / 2.3 % | 2.6 / 2.7 / 2.7 / 2.8 / 2.8 % | the same | unchanged |

## Scores

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | **7.2** (r13 7.1) | 1. **Behind the bridge (x .25–.80, y .47–.62):** the mockup shows cliffs dropping away into warm sunlit cumulus. The bulging green keel is gone, which is the right fix. But the gap now shows a narrow olive keel under a straight-edged deck slab, over a flat lavender cloud sea in horizontal bands that reads as a lake. It is darker than before (73 against 98; round 13 82). 2. **The cluster (x 0–1, y .17–.46)** has the right staggered forms and drapes, and some new puffs between them. Its finish is unchanged: olive-grey domes with bald tops, no lit gold rock faces, and 16.4 % hot under it against 5.2 %. 3. **The meadow (x 0–.45, y .55–.84)** matches in spread and grain, and its mid highlights are closer (p90 143 against 162). The nearest rows are still dark (46 against 56) and khaki. It has none of the three big boulders, and the fan is still about 1.8× the mockup's teal area. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | **6.9** (6.8) | 1. **The keeper and lectern (x .10–.43, y .43–.64) are unchanged** for the fourth round: a plain coat, no scarf or satchel, a mitten wave and a simple stand. 2. **The sky band (y .20–.50), scored on finish:** the mill isle now sits on a slimmer rock under its deck (x .55–.95, y .50–.58), closer to the mockup's spur. The flat lavender sea now shows beside it, and the cluster's finish is as in A. 3. **The foreground (x 0–.45, y .60–.85)** is pixel-identical to round 13: the spread matches, but it is straw-coloured with no white daisies. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | **6.4** (6.4) | 1. **The fan (x .55–1.0, y .57–.80)** is unchanged: 2.7 % teal against 5.0 %, a modest hold at the edge. The mockup's hero fan crosses the centre in a visible glove. 2. **The sky (y .04–.40)** is pixel-identical for the third round: upper left 152 against 205, chroma 35 against 70, top band sd 3.1 against 10.9. The 48 banks sit within about 1° of the horizon from here (y ≤ 34 m at 170–560 m), so they can never reach this band. 3. **Under the mill deck (x .30–.75, y .53–.62)** the keel is slimmer, but it shows the flat lavender sea through the bridge's ropes, where the mockup has the rocky cliff and warm cloud. The verge is pixel-identical to round 13. |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-opening`, 3.3 s) | **7.3** (7.0) | 1. **The Roc (x .03–.97, y .20–.50)** is a real gain. It is banked and asymmetric, with both wingtips inside the frame (x ≈ .05 and .95). It has no tears, and the sun is open again (sun patch 20.3 % hot against 36.8 %; round 13 3.2 %). But it still doesn't read as the mockup's eagle. The head is a dark brown cap over a large pale, faceted, glassy-looking face/breast mass (x .40–.55, y .30–.40), with no eye, no white head and no hooked yellow beak. The feet are white mittens with a dark spike under the right one (x .36–.40, y .44–.48), not the mockup's gold talons. The claimed gold toes and beak don't show. 2. **The sky (y .05–.62) is unchanged:** a violet pinwheel (chroma 35 against 25), and an empty orange gap between the stones (white 0.4 % against 8.0 %) with no cloud tops and no small isles. 3. **The arena (x 0–1, y .56–.85):** the stones and compass read, but the stones band is softer (hp 15 against 24). The fan still covers the dais's right half (2.8 % teal; the mockup has 0.5 % and no fan). |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | **6.0** (5.7) | 1. **The destination (x .05–.95, y .38–.56)** moved toward the mockup. The mossy bun is replaced by a slimmer rock under the deck (under-deck 134 against 180; it was 104). It is still a wide flat deck slab with a straight underside and a bare edge, not the mockup's narrow spur tapering into long roots, and the lavender sea now shows beside it. 2. **The ray and its wake (x .42–.75, y .29–.47)** are absent for the fourth round (white 1.0 % against 31.7 %). 3. **The foreground (x 0–.36, y .62–.84)** is pixel-identical to round 13: dark (p50 53 against 69, p90 108 against 159) and hay-coloured, with no daisies (0 against 4.7 %). |

**Seat score, Sky Reach: (7.2 + 6.9 + 6.4 + 7.3 + 6.0) / 5 = 6.76 → 6.8** (this seat in round 13: 6.6).

- **The gains are real:**
  - D's sun and the Roc's bank;
  - the playable keels no longer bulge (P, B, the aerials and the clip).
- **The cost:**
  - the keel fix exposed a flat lavender sea that reads as water behind A's and C's bridge (A darker, 73 against 98);
  - the playable islands read as thin coins from above.
- **Nothing moved** in C's sky, D's horizon, the meadow's colour, the fan, the keeper or P's ray. Row 5's banks are
  almost invisible in the five views.

## The README's and commits' claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Roc: blended skin, the tears gone | **Verified** | `rocSkin` replaces `bindRigid` for the HD model. No sky-coloured slits through the legs or tail in D (x .40 / .58, y .40–.50). |
| Roc: "D's sun patch 3.1 → 20.4 %", "p99 222.5 → 231.4" | **Reproduces** | 3.2 → 20.3 % and 223.1 → 232.5 on my resample. h4's sun is unchanged, so the gain is the bird moving, not a glare change. |
| Roc: "both wingtips in frame, head under the bar" | **True** | Tips at x ≈ .05 / .95; the head at y ≈ .30–.36, below the bar (y ≈ .25). |
| Roc: "beak and toes pushed to gold" | **Not visible in D** | The toes read white and grey, with no gold in the head. The roc-fix README's own "Open" note admits the face doesn't read. |
| Take-off "aims at the player's live position" | **Verified in code; see the audit for the perch-turn sign** | `want = yawTo(a, p.x, p.z)` with `p = ctx.player` (`stormRoc.ts:110`). |
| Keels "fit inside their decks" | **True; it exposed a new gap** | Narrow keels in the aerials and the clip. The space they left shows the flat painted sea (A behind the posts 82 → 73). From above, the spawn isle is a slab with a straight-cut skirt and no visible rock under it (aerial-spawn x .1–1, y .82–.95). |
| Meadow: "one constant shade" | **True in code, invisible in the pixels** | `diffuseColor.rgb *= 0.86`. A's nearest band went 45.9 → 46.3 (mockup 56). The blades, not the ground, set that band. |
| o3 "44 m from the lap's centre" | **Verified** | (−40, −214) is 46.6 m from (0, −190), clear of the crown. It now shows as a pale hazed isle behind the cluster in P and A, which is fine. |
| Row 5: "48 painted cumulus banks between and beyond the isles" | **True, but they barely reach the scored views** | `cloudBanks()` returns 48. They all sit 170–560 m out, at y −2…34, so from any deck they sit within a few degrees of the horizon. C's sky band and D's stone gap are unchanged (see the audit). |

## Ledger 5 audit (red team)

- **The 48 cumulus banks are real world-space objects, not cards placed for the mock cameras. Not a breach.**
  - *What they are:* instanced camera-facing billboards from the painted atlas (`look/puffs.ts`), at seeded world
    positions (`cloudBanks`, seed 7717, centre (0, −110), ring 170–560 m). They are the same technique and atlas as the
    380 sea puffs and the keel puffs the council has accepted since round 2. Plan row 5, written by the lead, asked for
    "camera-facing cards with depth fade".
  - *No camera input:* the placement uses no camera and no frame edge. Its rules are world rules:
    - clear of every isle's deck-to-keel column;
    - at least 90 m + the bank's size from every playable island (the nearest bank edge is 86.4 m from a playable rim,
      by my run);
    - the sun disc kept open from two eyes, the spawn and the crown deck centres.
  - *The sun gap holds everywhere, not just at the cameras.* I tested it from every playable island (centre and four
    points at 0.7 r). The nearest bank edge stays 3.3–12.0° off the sun from all 40 spots, so it isn't a view-only effect.
  - *Unreachable:* no player reaches a bank on foot or on the hover spans. They are sky, not a stand-in for walkable
    geometry.
  - *They hold up in the aerials and the clip:* they tilt with the camera like the existing puffs and read as part of the
    one painted cloud hand, with no cut-outs or stickers. The dropped Cycles cumulus is out of the build (`cumulus.webp`
    deleted).
  - *The one strict-reading caveat:* they are painted at a finite depth, not at infinity as one panorama. Under ledger 5's
    operative clause (the playable area; no card standing in for walkable geometry) and the plan's own row 5, I score
    that as compliant.
  - *Nit:* the shader has no depth fade against geometry (`depthWrite: false`, no soft-particle term). A future bank
    placed against a sky isle would show a hard intersection line.
- **The Roc's take-off is real play. Should-fix: the perch turn's sign was chosen for D's spot, not for where the fight
  starts.**
  - *The take-off is real:* it aims at `ctx.player` live. The stage, a retry and the first fight share one perch, one
    yaw (`perchYaw`), zero speed and one 4 s take-off.
  - *The staged pose is held, not frozen:* the swing is capped at 0.15 rad/s against a 0.8 rad offset. The lean
    (`off × 1.2`, clamped to 0.35) stays at its maximum from about 0.25 s to 3.3 s when the player stands at, or walks
    to, D's spot. So the 3.3 s frame isn't an instant.
  - *But the perch sits at (0, −204), and `ROC_PERCH_TURN = −0.8` turns it toward −x, the bridge side.* I replayed the
    take-off with the shard's own `yawTo` convention:
    - **From D's spot (0, −176):** offset 0.65 → 0.30 rad at 1 → 3.3 s, lean pinned at −0.35. This is the mockup's bank.
    - **From the bridge landing (−13.0, −177.0)**, where every fight begins: offset 0.20 rad at 1 s and 0.00 from about
      2.2 s, lean 0. The bird lines up head-on and level within about 2 s. That is the "frontal symmetry" the change was
      meant to cure, and it is what a player who stops at the landing sees.
  - *Why it isn't a breach:* both views are real play, and a player who walks on to D's spot keeps the bank, because the
    target slides as they walk. It is still a global constant tuned to D's camera: "whoever walks in sees its profile"
    holds only for D's line.
  - *Fix:* pick the perch turn so that the bridge landing gets the three-quarter view too. A bigger turn away from the
    bridge (+0.8 gives the landing 1.25 rad and D's spot 0.8 rad, both pinned) does that, but it mirrors the bank at D.
    Accept the mirror, or place the perch on the stone that gives both entries a profile.
- **Staged state:** `roc-opening` and `quest-crown` are unchanged and reachable (as audited in rounds 12–13).
- **Still props, screenshot tricks, a global grade:**
  - No LUT in either capture (de148d881), so no grade hides a material gap this round.
  - The meadow's "one constant shade" is a real fix of round 13's camera-distance ramp (`isle.ts`): closed.
- **No narrowing; regressions outside the mock views:**
  - The playable islands from above (aerial-spawn y .82–.95, the clip's near isles) are now thin decks with a vertical
    green-grey skirt cut straight along the bottom and no visible rock beneath. They read as coins, where round 13's read
    as decks on (too fat) rock.
  - h4's Roc left the frame (a wingtip at the top left in round 13), which is a lap moment, not a finding.
  - h2 differs only in the sails' phase. h3's step and grove keels are slimmer, with no loss.
- **Budget:** the fps pill reads 30 in every frame and `programs` is unchanged at 102. The banks add 48 instances to the
  existing single draw. I can't check the phone's memory from this surface.

## Findings, ranked by score gained

1. **Repeated, the biggest open gap: C's upper sky and D's stone gap** (C x .05–.60, y .04–.25: 152 against 205, sd 3.1
   against 10.9; D x .30–.50, y .50–.60: white 0.4 % against 8 %).
   - Row 5's banks can't reach either one:
     - from the decks they all sit within a few degrees of the horizon;
     - the crown's sun gap (5° plus each bank's own angular size) empties exactly D's gap, which lies 0–7° under the sun.
   - **Fix, for D:** keep only the disc itself clear: test the bank's angular box against the sun disc, not a cone. Then
     let low banks and two or three small far isles fill the gap under the sun, as the mockup has.
   - **Fix, for C:** C's band is the one shared dome. It needs layered, warm-lit cloud relief in the painted panorama at
     15–30° up, not more cards.
2. **New regression: the keel fix opened a flat lavender "lake" behind the bridge**, and the decks became slabs (A x .25–.80,
   y .47–.62: 73 against 98; C x .30–.75, y .53–.62; B and P beside the mill; aerial-spawn y .82–.95).
   - The mockups show cliffs falling away into bright, billowing cumulus.
   - **Fix:**
     - Bring the painted sea's near band up into lit cumulus where it is seen at a grazing angle from the decks. The keel
       puffs could ring each playable keel at mid-depth, not only low on its cone.
     - Taper the deck's skirt into the keel, so the rim isn't a straight-cut tabletop edge, and give the slimmer keels
       their root curtains below the rim.
     - Check on A, C and aerial-spawn.
3. **Repeated, D: the Roc's head and feet** (x .36–.55, y .30–.48).
   - The bank, the sun and the tips are right now. The face isn't: a dark cap over a pale glassy mass, no eye and no
     yellow beak, white mitten feet with a dark spike.
   - **Fix:**
     - Turn the head further toward the camera in the take-off.
     - Light the face and talons with the map's own colour (`ROC_HD.selfLight` is the README's named lever), so the gold
       beak and toes read against the backlight.
     - Check that the head bend (`ROC_HEAD_DIP`, the neck blend) doesn't fold the face into the breast. The close-up on
       `board-d.jpg` shows the same mass.
4. **New should-fix (ledger 5): the perch turn favours D's camera over the bridge landing.** See the audit. Choose the
   turn or the perch so that a fight entered from the landing also opens on a banked three-quarter bird.
5. **Repeated: the meadow's colour and nearest rows** (A, B, C and P foregrounds; B, C and P are pixel-identical to round
   13).
   - A's nearest band is 46 against 56, and the colour is khaki, not green-gold. P's crest is 53 / 108 against 69 / 159,
     with no daisies.
   - **Fix:** in the material, not a grade, push the blade tips toward warm yellow-green and lift the near tips. Seed
     daisies into P's crest and B's foreground.
6. **Repeated: P's ray** (x .42–.75, y .29–.47), absent for the fourth round. Bring the lap's near arc past the mill's
   right shoulder from this camera, checked over a whole lap.
7. **Repeated: the cluster's finish** (A x 0–1, y .17–.46): lit gold rock on the sun-rim faces, bushy crowns along the
   rims instead of bald domes, and less glare under it (16.4 % against 5.2 %).
8. **Repeated: the fan in C and D, and the keeper in B.**
   - C needs a real ordinary pose that brings the fan across the centre.
   - D's mockup has no fan; the hold covers half the dais.
   - The keeper still lacks the scarf, satchel, layered coat and open palm.
9. **Nit:** give the puff shader a depth fade against geometry before any bank is moved closer to a sky isle.

SCORE sky-reach: 6.8
