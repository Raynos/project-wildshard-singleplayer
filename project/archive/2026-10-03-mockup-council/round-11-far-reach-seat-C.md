# Round 11, seat C, Sky Reach (Claude, lens: red team)

2026-10-03. Bar 7.0 (ledger 4 as Jake amended it); I score the same way regardless.

Surface:
- The Sky Reach section of `art/mockup-council/round-11/README.md` and the five sheets.
- `progress/far-reach/20261003-0601-3307e64a/`: all 12 frames, `clip.mp4` (1 fps tiles plus full-res frames) and `meta.json`.
- Round 10's capture `20261003-0516-750b533a`, frame by frame. I diffed every shot pixel by pixel and diffed the meta.
- The five ledger mockups at full resolution.
- `git show` of a28f585cb, 3de757394, 21d5e913c and 3307e64a2. Source read at 3307e64a2: `species/stormRoc.ts`,
  `species/driftRay.ts`, `world/rayWake.ts`, `world/skyIsles.ts`, `world/crown.ts`, `layout.ts`, `plugin.ts` (stage
  hooks), `scripts/shard-progress.mjs` (calm), `src/engine/ui/Perf.ts`.

Method: every image is resized to 780×1688 (Lanczos). Brightness is Rec. 709 luminance (L). Regions are frame fractions
(x left→right, y top→bottom). "Fan-clear" crops stop at x ≤ 0.36 or x ≤ 0.47, clear of the fan. "hp" is the standard
deviation of L minus its 3 px Gaussian blur. Each cell reads mockup / round 10 / round 11.

## What changed since round 10 (pixel diff, L change > 25)

- About 6 % of each spawn frame changed: the cluster band (y 0.20–0.40) and the meadow's sway and flowers
  (y 0.65–0.82). In D, the Roc (y 0.25–0.35), the band between the stones (y 0.50–0.60) and the near grass changed.
- Every `camAt` is identical. Apart from the SHA, the label, `programs` (100 → 101) and the new `qa` block, the meta is
  identical.

## Scores

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` → `mock-A-spawn-look` | **7.0** | 1. **The cluster (x 0–1, y 0.20–0.37) is now one overlapping band, but it reads as a flat shelf.** o5 and o6 closed the gaps, so its mass is nearer the mockup's clump. But the band is a level row of tabletop mesas, each with lawn caps and lines of cone pines. The mockup's crags are rugged, with bushy crowns and long root curtains, at staggered heights, and they arch over a sun nested under them. The game's sun (x 0.29, y 0.39) sits in open cloud below-left of the band. Band chroma 83 / 71 / 68, p90 227 / 206 / 209. The thin waterfalls from o1 and o4 (x 0.17, x 0.62) have no counterpart in the mockup. 2. **The meadow (fan-clear x 0–0.36, y 0.66–0.84) is unchanged.** p50 61 / 68.5 / 68.3, chroma 43 / 61 / 62. No grey boulders (grey-stone pixels 1.7 % / 0 / 0). White daisies 0.21 % / 0.07 % / 0.07 %, so "tighter drifts" doesn't measure here. 3. **The middle band is still dim, and the fan is bigger than the mockup's.** Under the bridge (x 0.25–0.75, y 0.53–0.60): p50 108 / 81.5 / 84.6. The fan's teal covers 1.5 % of the frame against 0.8 %, over the right foreground. The mill is still a clean white tower. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` → `mock-B-quest-start` | **6.5** | 1. **The keeper and lectern (x 0.10–0.43, y 0.43–0.64) are unchanged.** The elbow wave is good, but the hand is a mitten, the coat is plain and the book and lantern are simple. 2. **The foreground (x 0–0.30, y 0.66–0.85) is straw.** p50 61.6 / 78.0 / 77.5, chroma 40 / 68 / 67. No lit grey stones, and no white daisies (0.27 % / 0 / 0). 3. **The sky (y 0.25–0.47).** Under the ruling I score only the cluster's finish. It is now an unbroken mesa shelf across B's open cumulus, with the same flat finish as A. The sun is at x 0.40, where the mockup's light floods in from the right edge. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` → `mock-C-hands-fan` | **6.2** | 1. **The fan (x 0.43–0.86, y 0.58–0.86) has the wrong hold.** The pivot is at the lower left and the leaf opens up and to the right. The glove sits apart at the right edge, and there is no tassel. In the mockup the pivot is in the glove at the lower right, and the leaf sweeps up-left across the centre. The leaf's teal share is 2.7 % against 1.6 %. 2. **The sky is dark and flat.** Upper sky (x 0.05–0.38, y 0.10–0.25): p50 205 / 152 / 152, chroma 70 / 31 / 32. The top band (x 0.20–0.60, y 0.04–0.09) is a featureless gradient: sd 10.9 / 3.1 / 3.1, hp 4.1 / 0.3 / 0.3. Under the ruling I don't score the cluster's presence; its finish is as in A. 3. **The foreground (fan-clear x 0.05–0.36, y 0.77–0.85) is straw.** p50 66 / 96 / 96, chroma 46 / 78 / 78. No rock, no flowers. |
| `round-11-review/mockup-D-crown-arena` → `mock-D-crown-arena` (staged `roc-opening`, 3.3 s) | **6.5** | 1. **The Roc (x 0.03–0.92, y 0.28–0.43) is seen from below and behind as it flies away.** Its wings are now nearly level (3de757394), but there is still no head or beak, the feet are two grey lumps, and a pale seam runs down the body. The far wing is a smeared, banded fan. The mockup's eagle comes at the camera three-quarter on. This is the staged heading (see ledger 5). 2. **The glare moved up out of the sun's halo but stays between the stones.** By fan-clear row band (x 0–0.47), the sun-halo rows y 0.425–0.475 are now *under* the mockup (37 / 35 / 26 % over 230 against 17 / 27 / 12 %). The rows between the stones, y 0.50–0.60, are still a bright wash: 4–8 % over 230 and p50 98–197 in the mockup, 12–20 % and p50 205–214 in the game. Between the stones (x 0.30–0.50, y 0.50–0.60): 6.8 % / 31.9 % / 28.3 %. The storm is violet and dark: p50 87 / 71 / 71, chroma 14 / 22 / 22. 3. **The arena ground is inverted.** Near grass (fan-clear, y 0.74–0.84): p50 55 / 98 / 98. The floor behind the dais (y 0.70–0.74): 66 / 42 / 42. The fan covers the dais's right half, where the mockup shows no fan (teal 0.5 % against 1.6 %). One gain: the lighter sky-isle shader now shows a lit isle between the right stones (x 0.90–1.0, y 0.52–0.60), as the mockup has. |
| `round-1-proposals/B-sky-reach` → `mock-proposal-B` | **5.8** | 1. **The manta is at the frame's edge, not beside the mill.** The ray sits at x ≈ 0.97, y ≈ 0.31, mostly cut off. Its wake is a faint, straight, whitish streak from x 0.80 to 0.97 at y ≈ 0.33: the additive cyan washes out over the peach cloud. The mockup's manta is large at x 0.55–0.75, y 0.38–0.47, beside the mill, with a bright cyan curling wake. 2. **The foreground (fan-clear x 0–0.36, y 0.62–0.84) is an unlit field.** p50 / p90 69 / 159 in the mockup, 59 / 93 in the game. Its white daisies are 2.8 % in the mockup and 0 % here, and it has none of the mockup's rock. 3. **The destination and the sky's finish.** The destination is a broad shelf with five pines, where the mockup has a narrow rooted spur. The mesa band now fills the air over the mill (ruled). Under the new sky ruling I don't score saturation, only finish: the game's sky is crisp, busy cumulus (sky patch hp 3.7 against 14.0), where the mockup has a soft hazed gradient. |

**Seat score, Sky Reach: (7.0 + 6.5 + 6.2 + 6.5 + 5.8) / 5 = 6.40 → 6.4** (this seat in round 9: 6.4; round 10 had no seat C).

Measured round 10 → 11 changes are small: the cluster's mass, D's halo rows and a ray that A and h1 can see. None of the
three biggest differences in any view closed.

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Cluster: five overlapping crags in one band, lighter, gold rims kept | **True as layout; the finish is unchanged; "lighter" is global** | o5 (−16, −162) and o6 (9, −186) were added. The ×0.82 → ×0.95 is in the shared sky-isle shader, so every sky isle got lighter, not just the cluster (in D it also lights o2 behind the stones, which is a gain). A's cluster band over 230: 8.6 / 0.7 / 2.4 %. The rim is still the view fresnel `pow(1 − |N·V|, 3)`, not sun-directed. |
| Roc wings near level, "alike at settles 3.0–3.7 s" | **The dihedral is true; the frame is still a back view** | 0.3 → 0.1 rad. One frame can't verify the 3.0–3.7 s window. The heading problem is unchanged (ledger 5). |
| D's middle band 9.1 → 6.5 % | **The number reproduces (9.18 → 6.36 %), but it was cut in the wrong rows** | Fan-clear, the halo rows y 0.425–0.475 fell from 21–36 % to 12–27 %, below the mockup's 26–37 %. The rows between the stones, y 0.50–0.60, stay at 12–20 % against 4–8 %. The roll-off is a real, global dome change (h4 fan-clear 23.3 → 17.8 %), not camera-specific. It dimmed the part of the sky the mockup has hot and left the bright band, which is the material gap. |
| Proposal B: the free ray circles beside the mill, inside the frame on most laps, with a luminous wake | **Mostly true; this capture doesn't show it** | Projecting the lap (14, −62) r 8 at y 39 into proposal B's camera puts it at x 0.64–1.03, y 0.32–0.33, inside the frame for 30 of 36 lap points. This frame caught it at the right edge. It never reaches the mockup's x 0.55–0.75 (its nearest point is x 0.64), and at ~65 m it is ~0.12 of the frame wide, against the mockup's ~0.2. The wake is the real ribbon. In `clip.mp4` it curls round the mill. |
| Meadow: tighter daisy drifts | **Not visible in any mock view** | White-flower pixels: A 0.07 → 0.07 % (mockup 0.21 %); B, C and P 0 → 0 % (0.27 / 0.05 / 2.8 %). The change (`0.2 · drift²`) thins the sparse areas as much as it fills the drifts. |
| No camera or staging changes | **True** | Every camAt is identical, and no commit touches `stage()`. |

## Ledger 5 audit (red team)

- **The views:** no camera moved (meta diff). The four commits touch no weapon or HUD file, so the fan is not grown
  further this round. Round 10's larger global hold still covers D's dais and A's right foreground; I score that as a
  difference, not a breach, since it matches C's bigger leaf.
- **Proposal B's ray: an ordinary route with a real wake. Not a breach.**
  - Captures calm every creature except in D (`shard-progress.mjs:139`). For a ray, calm is exactly its circling state.
    That is the state it holds anyway while the player is over 40 m away, and the spawn and proposal B's camera are
    57–65 m from its lap.
  - The lap is its real home circle, and every player sees it from the spawn (it shows in A and h1 too).
  - `rayWake.ts` builds a ribbon from the ray's own sampled positions (56 × 0.07 s). It is camera-facing, additive and
    depth-tested. It is an effect, not a card standing in for walkable geometry, and the clip shows it following the
    lap round the mill.
  - The home was moved for the mockup's framing, which is matching the world to the mockup, not dodging.
  - Side effect: the lap now lies over the windmill isle's east half, 9 m over the deck. The ray now dives at any player
    on that isle (h2 shows LOCK). That is consistent with the commit's "dives once you cross the bridge".
- **The cluster: one world, but o6 hangs inside the boss arena's airspace. Should-fix, new.**
  - It is one global layout: the same in A, B, C, P, h1, the aerials and every clip frame.
  - But o6 (9, −186, r 12, deck 78, keel 20) has its whole footprint inside the crown's rim (centre (0, −190),
    r 20). Its keel tip is at y 58: 14 m over the crown deck, 10 m over the eye in D, and 3 m over the Roc's lap height
    (y 55). It sits on the lap line: 13.45 m from the lap centre (0, −196), against r 13. The Roc stalks at the
    player's y + 10 = 54 under it.
  - The commit itself says o6's waterfall was dropped because "it fell through D's Roc". The waterfall went; the crag
    stayed.
  - It projects out of D and h4 only because it is ~40° right (x 1.66–1.80). A player in the arena who looks up and
    right at the Roc gets a crag ceiling where mockup D has an open storm eye.
  - o3's keel tip (y 50) hangs 6 m over the arena's south rim.
  - Both contradict `skyIsles.ts`'s own header ("each sits clear of every playable isle, bridge and route … well above
    or below the decks").
  - This isn't a screenshot cheat, but it is a layout chosen for one camera that worsens another place.
- **D's `roc-opening` is still not the walk-in frame. Should-fix, repeated (round 10 seat A, round 10 seat B).**
  - `stageOpening()` sets `angle = atan2(perch.z − ROC.z, perch.x − ROC.x) = −π/2`, perch (0, −204). So the take-off
    steers to (0, −209), due north, straight away from D's camera.
  - In a fresh fight nothing sets `angle`. It starts at 0 (field initialiser), and `begin` only sets `fighting`, so the
    first walk-in take-off steers to (13, −196): south-east, toward the player's right.
  - `restart()` leaves `angle` where the last lap ended.
  - So at 3.3 s a first-time player from the bridge landing sees the Roc turning toward them and to the right. The
    capture shows a back view that only a retry, whose last lap happened to end near −π/2, could produce.
  - It is reachable, so not void. And the staged heading probably costs the builder points rather than gaining them.
    But the answer to "does 3.3 s show what a walk-in player sees?" is **no**.
  - The staged `storm.strike(1.0)` forces a bolt that natural play gives every 3.5–8 s. No bolt is visible at 3.3 s.
- **A global change hiding a material gap.** The dome roll-off (21d5e913c) is honest and global. But it improves the
  full-band metric by dimming the sun halo, which the mockup has hot, while the bright wash between the stones (the real
  gap) barely moves. It is not a shortcut; it is a claim the region-by-row pixels don't support (finding 2).
- **Phone budget (watch, not a breach).**
  - The fps pill is red (Perf.ts `bad`: p50 > 33.4 ms) in 3 of 12 round-11 shots (first-frame, h3, aerial-spawn).
    In round 10 it was red in 0 of 12.
  - This round added two HD crags and a ribbon (programs 100 → 101).
  - A headless desktop capture is not a phone measurement, but the next round should quote one phone-tier reading.

## Findings, ranked by score gained

1. **D, repeated, should-fix (ledger 5): one opening for fresh, retry and staged, aimed at the player** (x 0.03–0.92,
   y 0.25–0.45).
   - Set the Roc's lap `angle` in the same place for all three paths. Best: when `fighting` first turns true, from the
     perch, the same way `stageOpening()` does. Then reset it in `restart()`.
   - Aim the take-off toward the arena's entrance (south, the bridge side) before it banks into the lap. Then every
     fight's 3.3 s shows the head, breast and dropped talons, as the mockup does.
   - Re-capture D without moving the camera. Fix the body seam and the far wing's banded mip.
2. **D and h4, repeated: put the glare fix where the glare is** (y 0.50–0.60 between the stones; h4 the same).
   - Roll back part of 21d5e913c's halo cut: the halo rows are now under the mockup.
   - Darken the cloud-bank puffs under the sun in the stone band instead: keep them out of a cone under the sun's
     direction, or cap their lit term. Show the cloud sea and isles there, as the mockup does.
   - Measure by row band on a fan-clear crop, never on the mixed y 0.45–0.65 band.
3. **Proposal B, new: the ray where the mockup puts it, and a wake that reads cyan** (x 0.55–0.80, y 0.30–0.47).
   - Shift the lap's near arc toward the mill's right shoulder, so the near half of every lap crosses x 0.55–0.75 from
     the proposal camera. Keep it a real circle beyond the 40 m notice range from the spawn.
   - Don't pick a capture moment to catch it.
   - Make the wake read as the mockup's cyan over peach cloud: a saturated core that isn't purely additive, curling for
     the length of a turn. Today it washes out to a white smear.
4. **Cluster, new should-fix plus a repeated finish item** (A, B, C, P: y 0.20–0.40; the crown's airspace).
   - Move o6, and o3's keel, out of the arena's column without changing how they look from A. Slide each one outward
     along the line from A's camera (0, 31.7, −10): its position, deck height, radius and keel all × the same factor,
     so its angular place and size from the spawn stay the same.
   - Then break up the shelf: stagger the crags' heights, give them bushy rounded crowns and dense root curtains, and
     make the rim depend on `N·sunDir`, not `N·V`. Check A, the aerials, and a look up from the crown.
5. **Meadow, repeated** (A, B, P, C, D foregrounds). The "tighter drifts" are not in the pixels.
   - Add the mockups' lit grey stones, real walkable placement, with white and yellow daisy clumps round them.
   - Cut the backlit straw glow near the camera in C and D (96 against 66; 98 against 55). Keep A's highlights.
6. **C's upper sky, repeated** (x 0.05–0.60, y 0.04–0.25). Lighten the dome's top and give it cloud structure
   (top band sd 3.1 against 10.9, hp 0.3 against 4.1): one shared dome, no per-view tint.
7. **The fan's hold, repeated** (C x 0.43–0.86, y 0.58–0.86; D's dais). Put the pivot in the glove at the lower right,
   the leaf sweeping up-left, with the tassel. One shared hold.
8. **The keeper, repeated** (B x 0.10–0.43, y 0.43–0.64). An open palm, a layered coat with a scarf and satchel, a
   readable book and a hanging lantern.

SCORE sky-reach: 6.4
