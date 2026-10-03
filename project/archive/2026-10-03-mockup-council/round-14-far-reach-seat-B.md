# Round 14, seat B, Sky Reach (Claude, lens: evidence, measured region by region)

2026-10-03. The bar is 7.0 (ledger 4 as Jake amended it). I score the same way whatever the bar is.

Surface:
- The Sky Reach section of `art/mockup-council/round-14/README.md` and the five sheets `art/mockup-council/round-14/far-reach-*.jpg`.
- `progress/far-reach/20261003-0823-ce11353e/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` (0.6 fps tiles) and `meta.json`.
- Round 13's capture `20261003-0719-8512344b`, for before and after. Both are LUT-off.
- The five ledger mockups at full resolution.
- `git diff 8512344bd ce11353ef -- src/shards/far-reach`, read for `stormRoc.ts`, `skyIsleHd.ts`, `skyIsles.ts`, `isle.ts`,
  `dressing.ts`, `look/render.ts` and `look/puffs.ts`.

Method (the same as my round 13, so the numbers compare):
- Each frame is resized to 780×1688 (Lanczos). Regions are fractions of the frame (x left to right, y top to bottom, HUD
  included).
- On each patch I take:
  - Rec. 709 luminance (L): p10 / p50 / p90, its standard deviation and the share above 230 ("hot");
  - the mean RGB, chroma (max − min) and the hue of the mean;
  - "hp", the fine detail: the standard deviation of L minus its 3 px Gaussian blur;
  - "white", the share with L > 170 and chroma < 60 (daisies, white cloud tops).
- Foreground patches stop at x ≤ 0.36, clear of the fan. My round-13 numbers reproduce to ±0.2 on the round-13 capture.
- **The scale of the change.** A whole-frame diff (|ΔL| > 12) changes 10.5–13.7 % of A, B, C and P, and 22 % of D
  (round 13: 34–45 %). The rows above y 0.20 are unchanged in every mock view, and so are the rows below y 0.70 outside
  the fan. The changes sit in four places:
  - the playable keels under the mill deck;
  - a handful of new cumulus masses at y 0.25–0.50;
  - the sails' turn;
  - D's Roc.

## Measured (mockup / round 13 / round 14)

| Patch | Mockup | R13 | R14 | Reading |
|---|---|---|---|---|
| D sun patch x .05–.45, y .44–.50: hot; p50; white | 36.8 %; 224; 10.4 % | 3.2 %; 192; 0.7 % | **20.3 %; 218; 11.5 %** | the sun is back (the README's 20.4 % reproduces) |
| D Roc extents (read off a 0.1 grid) | x 0.00–0.97, y 0.17–0.43, head x .51 y .35 | runs off both edges, y .17–.50, head behind the bar | **x .05–.98, y .22–.48, head x .40–.48 y .33–.38** | span, height (0.26) and bank now match; about 0.05 low |
| D Roc body x .30–.50, y .36–.42: p50; hp | 123; 19.4 | 93; 12.7 | 159; 12.7 | a big pale cream bib where the mockup is slate with a white head |
| D whole-frame p99 (measure.py: 390 px, rows 60–699) | 241.4 | 222.5 | **231.4** | reproduces the README |
| D between the stones x .30–.50, y .50–.60: chroma; white | 71; 8.0 % | 109; 0.4 % | 106; 0.4 % | unchanged: orange haze, no white cloud tops |
| D storm x .05–.65, y .09–.25: p50; chroma; hue | 87; 25; 328° | 70; 35; 294° | 70; 35; 293° | unchanged, violet |
| D dais top x .40–.58, y .65–.69: p50; hp; chroma | 79; 19.8; 48 | 100; 12.5; 67 | 98; 12.5; 65 | the clumps are gone; still a smooth tan disc |
| A beside the bridge, left x .14–.24, y .565–.60: p50; hue; hp | 53; 22°; 15.1 | 76; 41°; 7.8 | **144; 21°; 19.9** | the green blob is gone; now a pale lilac cloud-sea plane, where the mockup has dark cliff |
| A right of the bridge, between the posts x .62–.80, y .565–.60: p50; hue | 104; 16° | 75; 42° | 62; 39° | now the grey-olive rock keel; too dark, olive where the mockup's is rose |
| A under the bridge x .25–.75, y .53–.60: p50; hp | 108; 24.1 | 84; 14.4 | 73; 15.6 | further in value; the form is better (rock, not moss) |
| A subject band y .45–.65: p90; white | 180; 4.8 % | 136; 0.7 % | **173; 1.4 %** | closer |
| A under the cluster y .36–.46: hot | 5.2 % | 15.6 % | 16.4 % | unchanged, 3× |
| A cluster band y .22–.36: p50; chroma | 174; 80 | 157; 74 | 164; 74 | a little closer |
| A nearest band x 0–.36, y .76–.84: p50 | 56 | 46 | 46 | unchanged, though the 0.72 → 0.86 shade changed (below) |
| B near ground x .03–.32, y .68–.82: p50; p90; sd | 65; 124; 35 | 61; 122; 32 | 61; 122; 33 | unchanged (a match) |
| C upper sky x .05–.38, y .10–.25: p50; chroma | 205; 70 | 152; 35 | 152; 35 | pixel-identical for the fourth round |
| C top band x .20–.60, y .04–.09: sd; hp | 10.9; 4.1 | 3.1; 0.3 | 3.1; 0.3 | the same |
| C verge x .05–.36, y .77–.85: p50; p90 | 66; 131 | 74; 131 | 74; 132 | unchanged |
| P under the mill deck x .55–.90, y .40–.50: p50; hue; white | 180; 22°; 16.4 % | 104; 38°; 2.0 % | **134; 34°; 4.5 %** | closer: rock and cloud instead of the moss bun |
| P ray zone x .42–.80, y .29–.47: white | 31.7 % | 0.6 % | 1.1 % | still no ray or wake |
| P foreground x 0–.36, y .62–.84: p50; p90; white | 69; 159; 4.7 % | 53; 108; 0 | 53; 108; 0 | unchanged |

**The Roc, read off full-resolution crops of D:**
- **What matches now:**
  - The tears and the stray lump are gone. The bird is banked left-wing-high, as the mockup's is.
  - Both wingtips are inside or at the frame's edge.
  - The head is below the boss bar, at nearly the mockup's height (y 0.35).
  - The sun shows beside its left foot (x 0.22, y 0.46; the mockup's sun is at x 0.24, y 0.46).
- **The face doesn't read.** The head is a dark brown cap on a pale cream block, with the lock marker on it. There's no
  white head, no eye and no hooked yellow beak, so it reads as a masked or penguin-like face rather than an eagle. The
  feet hang as white feathered boots with black claws, where the mockup has curled gold talons.

## Scores

| Mockup | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.6** (r13 7.5) | 1. **The cluster (x 0–1, y 0.17–0.46) is unchanged in finish.** The rock is olive-ochre (hue 31° against 25° on the isles), with bald mossy tops and one tree each, and the cloud wall under it is still hot (16.4 % against 5.2 %). A few new cumulus masses sit between the crags. 2. **Under and beside the bridge (x 0.12–0.88, y 0.53–0.62):** the green moss ball is gone, which is the round's main gain here. In its place is a grey-olive rock keel with roots, and through the narrower keel a flat, horizontally banded lilac cloud-sea plane (left patch p50 144 against the mockup's dark cliff at 53). The rock right of the bridge is too dark and olive (62, 39° against 104, 16°). 3. **The meadow (x 0–0.36, y 0.66–0.84) is unchanged:** a match in value and spread, but a hatched pale mat with no boulders. The nearest band is still 46 against 56. The fan and the lattice sails are unchanged. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **7.3** (7.2) | 1. **The keeper and lectern (x 0.10–0.27, y 0.45–0.62) are pixel-identical to round 13:** a plain coat, no scarf or satchel, a mitten wave and a simple stand. 2. **The sky band (y 0.18–0.47), scored on finish under the lead's ruling:** the mill's keel behind the keeper (x 0.80–1.0, y 0.50–0.56) is rock now, not the green bun. The cluster's finish is as in A, and the band reads 170 against 175. 3. **The foreground (x 0–0.45, y 0.60–0.86)** matches in value (p50 61 against 65, p90 122 against 124), but it is straw blades with no daisies (0 against 0.3 %). |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **6.9** (6.8) | 1. **The fan (x 0.55–1.0, y 0.58–0.81) is unchanged:** the modest hold, about half C's hero leaf (x 0.39–0.90), with the glove under JUMP. 2. **The sky (y 0.04–0.40) is pixel-identical for the fourth round:** 152 against 205 and chroma 35 against 70 in the upper left; top band sd 3.1 against 10.9. Row 5's banks are all below y 0.25. 3. **Left of the bridge (x 0–0.30, y 0.50–0.66):** the moss blob is now rock and the lilac cloud plane, which is closer to the mockup's cliff and cloud. But that patch is a flat banded sheet (p50 195 against 127), not cumulus. The verge is unchanged. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-opening`) | **7.7** (7.3) | 1. **The Roc (x 0.05–0.98, y 0.22–0.48) is now the mockup's shot in silhouette:** the same span, height and bank, head below the bar, with no tears. But the face is a dark cap on a cream block, with no white head, eye or gold beak. The breast is a big pale bib (p50 159 against 123), and the talons are white boots, not gold. 2. **The light is back:** the sun shows beside the bird (sun patch 20.3 % hot against 36.8 %; it was 3.2 %). But the storm is still violet (293° against 328°, chroma 35 against 25), and the gap between the stones is still an orange haze with no white cloud tops or small far isles (white 0.4 % against 8 %). 3. **The arena (y 0.60–0.86):** the grass is off the dais. The dais is still a smooth tan disc with a centre spike (hp 12.5 against 19.8, chroma 65 against 48), not cut grey slabs and a flush compass. The fan covers the dais's right half, where the mockup shows none. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **6.4** (6.1) | 1. **The mill isle (x 0.38–0.95, y 0.36–0.56):** the moss bun under the deck is replaced by a rock keel with roots, tapering inside the deck. That moves toward the mockup's rocky spur (p50 134 against 180; it was 104). The deck is still the broad flat shelf, and the right horizon is the flat lilac plane. 2. **The ray and its wake are absent for the fourth round** (x 0.42–0.80, y 0.29–0.47, white 1.1 % against 31.7 %). 3. **The foreground (x 0–0.36, y 0.62–0.84) is unchanged:** dark (p50 53 against 69, p90 108 against 159), with no daisies (0 against 4.7 %) and no rock spur edge. |

**Seat score, Sky Reach: (7.6 + 7.3 + 6.9 + 7.7 + 6.4) / 5 = 7.18, rounded to 7.2** (round 13, this seat: 7.0).

Both regressions from round 13 that cost points are fixed: the green windmill keel (A, B, C, P) and the Roc over the
sun (D). Nothing else in the frames moved. C's sky, P's ray, the keeper, the fan, the meadow and D's storm are
unchanged, and row 5's banks add little to the mock views.

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| The Roc's tears were the rig; it now uses blended skin | **Verified** | `rocSkin` replaces `bindRigid` for the textured model. D's legs and tail show no slits. |
| The lump is deleted and the tail's fake claws painted out | **Verified as far as D shows** | There's no stray beaked lump in the tail. |
| It flies near level, head up | **Body verified; the face isn't** | `ROC_HD.pitch` 0.45 → 1.1, and the head is bent back by `ROC_HEAD_DIP − pitch`. The body is level and banked, but the head shows a dark cap with no beak or eye. The README says this itself. |
| The take-off aims at the live player, with a three-quarter bank | **Verified in code** | `want = yawTo(a, p.x, p.z)` with `p = ctx.player`, the lean ±0.35 rad, and a perch turn of −0.8 rad from the entrance. All of it is global, not tied to D's camera. |
| A restart or the stage zeroes the Roc's speed | **Verified in code** | `restart()` and `stageOpening()` both set `speed = 0` and `rocBank = 0`. |
| D's sun patch 3.1 → 20.4 % (mockup 36.7); D's p99 222.5 → 231.4 | **Reproduces** | 3.2 → 20.3 % (36.8 %); p99 222.5 → 231.4 on measure.py's crop. |
| The keels fit inside their decks (0.88 of the radius), stone only | **Verified** | `keelInset: 0.88`, `keel.windmill` → `isle-mass-hd`, `keel.crown` → `isle-spire-hd`, and `turf = 0.0` when `clipTop` is set. Both aerials and the orbit show tapering rock under every deck. |
| The meadow's distance darkening is now one constant shade | **Verified in code; no visible effect** | `diffuseColor.rgb *= 0.86`. A's nearest band is 46.3 against 45.9 in round 13 (the mockup's is 56), so the blades cover the ground there. The ledger-5 should-fix is closed. The value gap isn't. |
| Isle o3 moved to (−40, −214) | **Verified** | It is 46.6 m from the crown's centre (0, −190), clear of the crown's 20 m and the 13 m lap. Round 13's should-fix is closed. |
| No grass clumps on the dais | **Verified** | `dressing.ts` skips every `meadowHoles()` disc. D and h4 show a clean dais. |
| Row 5: 48 painted cumulus banks | **In code; small in the mock views** | `cloudBanks()` places 48 banks. In A, B, C and P a few new cloud masses appear at y 0.25–0.50, and 10–14 % of each frame changed. A's under-cluster hot share (16.4 %), C's sky and D's stone gap don't move. The aerials show the banks clearly. |
| Luminance top 1 % (P 239.0, A 239.2, B 236.4, C 240.2, D 231.4) | **Reproduces exactly** | measure.py's convention (390 px, BICUBIC, rows 60–699). |

## Ledger 5

- **Cameras and staging:** the cameras blob (`f3e3cb06…`), every `camAt`, `staged`, `active` and `programs` (102) are
  identical to round 13. `retaken` is empty and there are no page errors.
- **D's staged frame:** it is the same 3.3 s `roc-opening` as before. The take-off now steers at `ctx.player`, so the
  bird turns toward wherever a player stands, and from D's spot that is the camera. A player entering from the bridge
  landing gets the same turn toward them, so the frame is real play. The lower take-off speed (`speed * k`) is the same
  for every entry. Not void.
- **Placement by view, nit:** `cloudBanks()` leaves the sun disc clear "from the spawn and from the crown" (the eyes at
  sunrest and the crown, 5° plus the bank's angular size). That is a global rule keyed to the two islands the mock
  cameras stand on, and it only removes clouds from in front of the sun. It also keeps banks out of D's sun-side gap,
  which is exactly where the mockup has white cloud tops (finding 3). Not a breach.
- **No narrowing:** h1–h4, the aerials and the clip show the same world. The keels are better everywhere (the aerials'
  green buns are gone). h4 is unchanged apart from the clean dais. The Roc is out of h4's frame in both rounds.
- **The shipped look:** the LUT is out of the build (de148d881), so this LUT-off capture is what ships.
- **Budget:** `budgetCeilings.ts` records gpuMB 234.4 → 249.1 (phone) and 348.8 → 363.6 in this diff: round 13's
  re-recorded ceilings, under the 1.8 GB / 1.0 GB caps. The fps pill reads 30 in all five views. I
  can't verify the phone's memory caps from this surface.

## Findings, ranked by score gained

1. **Repeated (round 13 finding 1, half closed): D's Roc has no face** (D, x 0.38–0.50, y 0.32–0.39; feet x 0.30–0.45,
   y 0.43–0.48).
   - **Evidence:** the silhouette, bank and size now match. The head is a dark cap on a cream block, with no white
     head, eye or yellow beak. The breast reads p50 159 against 123, and the talons are white.
   - **Fix:**
     - Render the textured model alone from D's bearing (the Model Explorer) and check what the dark patch is.
       `ROC_HEAD_DIP − pitch` = −0.8 rad bends the head a long way, and it may be showing the crown or the back of the
       head to a viewer below and ahead.
     - Reduce the bend until the white face and gold beak point at a viewer under the flight line.
     - Tint the breast toward slate below the neck, and paint the toes and claws gold in the map.
2. **Repeated: C's sky is pixel-identical for the fourth round** (C x 0.05–0.60, y 0.04–0.25: 152 against 205, chroma 35
   against 70, top band sd 3.1 against 10.9).
   - **Evidence:** row 5's banks are all below y 0.25, and the dome hasn't changed since round 12.
   - **Fix:** warm the shared dome above ~25° toward A's and C's gold (the lead's ruling), and give the top band
     painted cloud structure.
3. **Repeated: D's horizon and storm** (D x 0.05–0.70, y 0.44–0.62; x 0.05–0.65, y 0.09–0.25).
   - **Evidence:** between the stones there is still an orange haze (white 0.4 % against 8 %, chroma 106 against 71).
     The storm is still violet (293° against 328°).
   - **Fix:** let `cloudBanks()` place low banks beyond the crown, below its deck line, with lit white tops. Keep the
     `sunGap` to the disc itself, so the stone gap fills. Add two or three small far isles there, as the mockup has.
     Desaturate the maelstrom toward slate.
4. **New, partly a fix: what shows under the playable decks** (A x 0.12–0.88, y 0.53–0.62; C x 0–0.30, y 0.50–0.66;
   P x 0.55–1.0, y 0.45–0.55).
   - **Evidence:** the keels are rock now, a fix. But the narrower keel exposes a flat, horizontally banded lilac
     cloud-sea plane (A's left patch 144 where the mockup's cliff is 53; C's 195 against 127). The keel rock is dark
     olive (A's right patch 62, 39° against 104, 16°).
   - **Fix:** wrap the playable keels in the existing `keelPuffs()` cumulus, so cloud rather than the flat sea plane
     fills the gaps under the bridge. Warm the `clipTop` stone toward the mockups' rose-brown (about 150, 105, 85 lit).
5. **Repeated: the cluster's finish and the hot band under it** (A x 0–1, y 0.17–0.46).
   - **Evidence:** olive rock with bald tops, and 16.4 % hot against 5.2 % under it.
   - **Fix:** rim crowns of the modelled bushes and pines on the caps, rose-tinted rock, and a dimmer cumulus core
     under the cluster.
6. **Repeated: proposal B's ray is absent for the fourth round** (P x 0.42–0.80, y 0.29–0.47). Bring the lap's near arc
   past the mill's right shoulder at sail height, checked over a whole lap from the fixed camera.
7. **Repeated: the foreground's last step** (P x 0–0.36, y 0.62–0.84: p50 53 against 69, p90 108 against 159, no
   daisies; A's nearest band 46 against 56).
   - **Evidence:** the constant 0.86 shade didn't lift the near rows, because the blades cover the ground there.
   - **Fix:** lift the blades' base colour on the near tiles; don't change the shade rule. Add daisy drifts on P's and
     B's approach, and boulders beside A's path.
8. **Repeated: D's dais and fan** (D x 0.15–0.60, y 0.64–0.72).
   - **Evidence:** a smooth tan disc with a centre spike (hp 12.5 against 19.8). The fan covers the right half.
   - **Fix:** slab joints and a flush compass in the dais's map, grey stone, and no spike.
9. **Repeated: the keeper** (B x 0.10–0.27, y 0.45–0.62; row 10's keeper half), and C's hero fan.

SCORE sky-reach: 7.2
