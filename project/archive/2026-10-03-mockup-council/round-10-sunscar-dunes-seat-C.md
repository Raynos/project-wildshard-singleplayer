# Round 10, seat C (Claude, red team), Signal Dunes

Surface: the "Signal Dunes, round 10" section of `art/mockup-council/round-10/README.md` and its five sheets; the full-res
frames in `progress/sunscar-dunes/20261003-0432-0ae71b2a/` (every `mock-*`, h1–h4, both aerials, `clip.mp4` at 1 fps,
`meta.json`); round 9's `20261003-0356-544f6b56/` for before and after; the five ledger mockups at full resolution,
Lanczos-scaled to 780×1688. Source checks: `git show` of the nine shard commits the README lists, and
`git diff 544f6b56 0ae71b2a -- src/shards/sunscar-dunes` (read at the captured SHA, not HEAD). I decoded both captured
`terrain.bin` bakes (256², 500 m) and sampled them with the engine's bilinear lookup, and compared every shot's camAt.
All brightness is Rec. 709 luma on the decoded JPEGs. Clean sand is the seats' patch **x 10–180, y 1150–1450** (clear of
the coil, Sefa and the HUD in all 15 frames). Fine detail is mean |luma − luma blurred at σ 2 px|. Macro r is the Pearson r
of σ-12 luma, mockup against game, over a named band. Regions are fractions of the portrait frame (x left → right,
y top → bottom).

**The short version.** Real gains:
- C's fire has crisp licks and a hotter core.
- A's afterglow now peaks right of the tower.
- dusk-fire's lit left shoulder is there, and the tower is where the mockup has it.
- B's crates stand on the sand.
- The far land under C and D's horizons is darker.

Four changes cut the other way:
- The NNW key pushed A's near sand to 49 % over its mockup.
- The lower hold put D's fist, the subject of its mockup, in the frame's corner under DODGE / JUMP.
- A 2.4 m caravan halo with depth testing off washes the canvas.
- The far-land darkening is a fade to black centred on the camera. It starts at 8 m, just past the seats' patch. It
  blacked out the late-dusk clip (ground 40 → 7 luma) and did not draw the mockups' bands.

None of these voids a score. Two are should-fix items under ledger 5 (below).

## The measurements (mockup / r9 / r10)

| View | Clean sand mean | Fine | Sky box (40,300)–(540,600) | Macro r, band |
|---|---|---|---|---|
| dusk-fire | 73.4 / 64.9 / **80.3** | 9.3 / 11.0 / **10.1** | 75.9 / 94.2 / **112.8** | x 0–1, y 0.36–0.58: +0.09 → **+0.36** |
| A spawn | 55.6 / 68.6 / **82.7** | 9.3 / 11.9 / **11.0** | 88.3 / 92.9 / **107.7** | x 0–1, y 0.34–0.58: +0.18 → **+0.20** (mean diff 25.3 → **33.7**) |
| B logbook | 38.9 / 40.2 / **31.1** | 2.3 / 3.7 / **3.4** | 50.1 / 47.1 / **47.1** | x 0–1, y 0.40–0.60: +0.41 → **+0.58** |
| C waymark | 32.2 / 41.9 / **36.1** | 1.1 / 1.6 / **1.8** | 52.5 / 50.3 / **50.0** | backdrop x 0–0.25, y 0.30–0.50: +0.60 → **+0.40** |
| D hands | 34.6 / 38.2 / **33.7** | 1.4 / 1.7 / **2.0** | 50.0 / 49.9 / **49.9** | land x 0–0.3, y 0.50–0.66: +0.33 → **−0.13** |

On the wider x 10–240 patch: B 39.0 / 41.6 / **32.3**, C 32.4 / 41.8 / **35.7**, D 34.5 / 38.3 / **34.0**.

**The dune band, 10 × 0.02 grid (luma):**
- **A:**
  - The mockup's left third (x 0–0.3, y 0.38–0.48) is shade at 28–47, with a lit diagonal at x 0.3–0.8 (77–107).
  - r10's left third is **lit at 93–114**, brighter than r9's 46–74. The crest line's lit shelf runs x 0.3–0.6 at
    y 0.44–0.56 (76–93), with its lee in shade at x 0.6–1, y 0.38–0.50 (30–44).
  - The shade is on the wrong side again, now with a crisp edge.
- **dusk-fire:**
  - The lit left shoulder (x 0.1–0.4, y 0.42–0.56) is **80–93** against the mockup's 71–92 (r9 30–70). A gain.
  - The centre (x 0.4–0.7, y 0.40–0.50) is 31–36 against 45–66: too dark.
  - The lower right (x 0.5–1, y 0.52–0.56) is lit at 69–85, where the mockup is in shade at 41–48.

**The sky:**
- **A's glow by fifths, y 0.31–0.34:** mockup 103 / 118 / 114 / 148 / 162; r9 flat at 114–123; **r10 118 / 132 / 144 /
  155 / 157.** Fixed.
- **dusk-fire, same fifths:** mockup 130 / 87 / 99 / 115 / 122; **r10 133 / 144 / 157 / 157 / 145.** It now overshoots
  in the middle.
- **Cloud residual sd (y 0.15–0.33, left / right; share of pixels over +15):**

  | View | Mockup | r9 | r10 |
  |---|---|---|---|
  | A | 9.4 / 14.1; 11.4 % | 8.3 / 9.8; 2.8 % | **14.5 / 12.7; 12.3 %** |
  | dusk-fire | 17.1 / 10.8; 5.7 % | | **13.9 / 12.1; 8.8 %** |

  The amount is right now. The banks are soft blurred masses, where the mockups' are streaked and crisp-edged.

**C's fire** (box x 150–450, y 350–900):

| | Mockup | r9 | r10 |
|---|---|---|---|
| Pixels over 150 | 13 733 | 15 884 | **17 112** |
| Their mean | 213 | 180 | **189** |
| Pixels over 235 | 4 649 | 311 | **988** (21 %) |
| Pixels over 230 | 5 557 | 730 | **2 060** |
| Pool | 40.4 | 59.2 | **50.7** |
| Pale column, top centre (420,60)–(560,200) | 26.6 | 55.3 | **42.6** |
| Smoke up-left (40,170)–(200,260), RGB | 44,32,47 (smoke) | 27,31,77 (sky) | **27,31,77 (sky)** |
| Post R/G | 2.33 | 6.86 | **5.34** |

**D:**
- **Afterglow column (x 300–500):**

  | | Peak | At y | RGB | Rows over 100 |
  |---|---|---|---|---|
  | Mockup | 170 | 0.497 | 214,161,129 | 121 |
  | r9 | 130 | | | |
  | r10 | **195** | 0.478 | **252,185,135** | **79** |

- **Rows y 0.51–0.58:**
  - mockup 23 / 12 / 12 / 14 / 12 / 12 / **50** / 12 (dark bands with a lit stripe);
  - r9 52 / 50 / 48 / 47 / 32 / 34 / 37 / 37;
  - **r10 30 / 25 / 28 / 27 / 25 / 27 / 29 / 26 (flat).**
- **Ground (x 0–0.5, y 0.52–0.62):** 16.0 / 47.3 / **38.2**.
- **Glove (600,1130)–(780,1330):**

  | | Mockup | r9 | r10 |
  |---|---|---|---|
  | p95 | 71.6 | 49.5 | **49.4** |
  | Fine | 7.7 | 3.2 | **3.4** |

- **The coil at 1:1:** mockup p99 117, with 1 312 pixels over 80. r10 **p99 64, 0 pixels over 80.**

**B:**
- **The wagon front (x 0.45–0.60, y 0.41–0.47):** 58.3 / 68.7 / **90.7**.
- **h2's canvas (x 0.30–0.45, y 0.36–0.44):** 75.1 → **105.2**.
- **Cargo (x 0.12–0.30, y 0.49–0.53):** 44.1 / 56.6 / **40.6**.
- **The land left of the camp (x 0–160 px, y 0.455–0.475):** 39.4 / 84.2 / **75.5**.

**clip.mp4** (the late-dusk orbit; frames 1, 5 and 10):

| | Ground mean (y 0.30–0.95) | Glow band (y 0.10–0.20) |
|---|---|---|
| r9 | 38.8 / 42.1 / 40.2 | 127 / 105 / 82 |
| r10 | **7.5 / 8.2 / 5.6** | **184 / 158 / 121** |

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.6** | 1. **Sky (x 0–1, y 0.10–0.36).** It moved away. The box is 112.8 against 75.9 (r9 94.2), and the low band is 125–157 against 81–119. Soft peach cloud masses sit on both sides, where the mockup has one dark grey-brown streaked bank at the right. There is still no ray over the tower, and the keeper's flame is a pin-point. 2. **The tower dune's light (x 0–1, y 0.38–0.58).** A gain: the lit left shoulder is in (80–93 against 71–92), the lee edge is crisp, and macro r went from 0.09 to 0.36. Still wrong: the centre is 31–36 against 45–66, and the lower right is lit (69–85) where the mockup is in shade (41–48). The crest line's lee adds a dark tongue the mockup doesn't have. 3. **Foreground (y 0.56–0.86).** The near sand now overshoots (80.3 against 73.4) with grain 10.1 against 9.3. The coil's two rings rise from the bottom edge, nearer the mockup's one low loop than r9's upright pair. Sefa stands at the left edge since the re-aim. The tower is now at x ≈ 0.37 (mockup 0.38). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.2** | 1. **The near sand (x 0–1, y 0.56–0.86).** A regression: 82.7 against 55.6 (r9 68.6), RGB 117,76,50 against 83,49,36, so the largest area of the frame is 49 % too bright and too orange. 2. **The landform's light (x 0–1, y 0.36–0.56).** The crest line reads as a dune at this distance: a lit shelf, a crisp brink, a shaded lee. But the key now lights the left third (93–114), which the mockup has in shade (28–47), and the mockup's receding diagonal crests at x 0.3–0.8 are not there. Macro r is 0.20 and the mean difference worse (33.7, from 25.3). 3. **Sky and coil.** The glow now rises right of the tower (157 against 162: fixed), and the cloud amount matches. But the banks are blurred blobs where the mockup's are thin, crisp, streaked banks, and the box overshoots (107.7 against 88.3). The rings now rise from the bottom edge like the mockup's, but read as a printed tan chevron rope beside a lumpy glove. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.5** | 1. **The caravan's light (x 0.40–0.70, y 0.38–0.52).** The lantern has a hot centre now. But its 2.4 m additive halo, drawn with depth testing off, lays a flat orange disc over the whole canvas front: 90.7 against 58.3 (r9 68.7). The mockup has a lit lantern inside a darker arch over a readable tailboard; the halo hides the tailboard. 2. **The land and the horizon (x 0–0.6, y 0.44–0.60).** The pale lavender ranges and the haze band are still 75 against 39. The near sand overshot downward (31.1 against 38.9; r9 40.2), so the ground now reads too dark. The smoke is still a thin pale column. 3. **Camp and coil (gains).** The crates stand, one stacked on the other, and the cargo is 40.6 against 44.1. The two rings now rise from the bottom right as the mockup's do, though the plait reads as tan chevrons. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.7** | 1. **The fire (x 0.22–0.55, y 0.15–0.47).** The best gain of the round: crisp separate licks and a white core (pixels over 235: 311 → 988; bright mean 189 against 213). It is still 21 % of the mockup's white-hot area. The licks are thin and translucent, not a dense roar, and no logs read through them. 2. **Smoke and embers (x 0–0.55, y 0.0–0.35).** The mockup's grey-brown billow up-left is absent: that region is plain sky (27,31,77 against the smoke's 44,32,47). The pale column at the top is weaker (42.6 against 26.6; r9 55.3). 3. **The brazier and the ground (x 0.3–0.5, y 0.45–0.62).** The post is still red copper (R/G 5.3 against 2.3) on a brick plinth. The larger coil now hides the plinth's base. The sand (36.1 against 32.2) and the pool (50.7 against 40.4) are closer. The land under the horizon is now dark, but the dune shoulder at the left edge reads as a darker mass, and the backdrop's macro r fell (0.60 → 0.40). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.1** | 1. **The hero hand (x 0.25–1, y 0.55–0.86).** A regression. The lower hold and bigger loops put the fist in the bottom-right corner, half under DODGE / JUMP. The loops span x 0.25–0.75 across the centre, where the mockup's raised fist holds slim loops at 0.57–0.81. The plait reads as flat tan chevrons with no sheen (p99 64 against 117). The glove is unchanged: p95 49.4 against 71.6, fine 3.4 against 7.7. 2. **The land (x 0–1, y 0.50–0.66).** It is darker (rows 25–30 against r9's 47–52), but flat. The mockup's long dark bands with a lit stripe (12 / 50 / 12) are missing, and macro r went from 0.33 to −0.13. The darkening is a fade with distance from the camera, not form (ledger audit). 3. **The afterglow (y 0.44–0.50).** The new line is hot and thin: peak 195 at (252,185,135) against 170 at (214,161,129), and 79 rows over 100 against 121. The mockup's is a broad peach band. The zenith is still 37 against 25. |

**Seat score, Signal Dunes: (6.6 + 6.2 + 6.5 + 6.7 + 6.1) / 5 = 6.4.** This seat's earlier scores: 4.6, 5.1, 4.9, 5.2,
5.6, 5.3, 5.7, 6.1, 6.4.

## Builder's claims checked

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| Late clean-patch sand B / C / D 36.6 / 37.5 / 33.4 | **B does not reproduce** | Measured at e2dec8b5e, before the key and terminator commits. At the capture: B **31.1** (x 10–240: 32.3), C 36.1, D 33.7. B now undershoots its mockup by 20 %. |
| The key NNW "by a measured sweep" | **True as stated, and costly** | The commit itself records A at 78.8 against 56.2. I measure 82.7, against r9's 68.6. Both spawn views now overshoot (A +27, dusk-fire +7), so this is no longer a split of the two mockups' conflict. |
| A crisp terminator | **True** | The lee edges are lines in A, dusk-fire and h1. In the aerials it also stamps hard-edged dark ovals on hollows (finding 8). |
| Glow line over darker land | **Line true; land partly** | D's peak is 195 at y 0.478, and the land is 25–30. The land is flat, not banded. B's land is still 75 against 39. |
| The far land darkened at dusk | **True, by a camera-distance fade** | `sil = smoothstep(8, 60, length(vSandPos − cameraPosition)) * smoothstep(0.3, 0.75, uDusk) * 0.75`, plus a near-black fog colour (0x110b16). See the ledger audit. |
| The fire's hot core; the bowl's width | **Core better, still short** | Pixels over 235: 988 against 4 649. The width reads near the bowl's. |
| The lantern's hot centre and halo; "the hood's even glow down" | **Centre true; hood false** | The hood front is 68.7 → **90.7** (mockup 58.3), and h2's canvas 75 → 105. The halo is 2.4 m, additive, `depthTest = false` and never frustum-culled. |
| Crates standing on the sand | **True** | The small crate is stacked on the big one, and the collider follows. Cargo is 40.6 against 44.1. Their self-light (emissive) was raised. |
| The post greyed | **Partly** | R/G 6.86 → 5.34 (mockup 2.33). It still reads copper. |
| Idle hold lower, loops bigger, cord 0.04 | **True** | It helps A, B and dusk-fire. It costs D its fist (above) and covers C's and h3's plinth. |
| The glove's creases in the albedo | **Not visible** | p95 49.5 → 49.4, fine 3.2 → 3.4 (mockup 71.6 / 7.7). |
| The plait's crowns lighter | **Pattern, not sheen** | It reads as printed tan chevrons. Coil p99 64 against 117, with nothing over 80. |
| Clouds broken into masses | **Masses true, finish no** | The amount matches A (12.3 % against 11.4 %), but the edges are blurred. The banks now sit on both sides in dusk-fire too, whose mockup has one at the right. |
| The crest line | **Real terrain, a shelf** | See the ledger audit. |
| Dusk-fire yaw −10 → −8 | **True** | The tower is at x ≈ 0.37 (mockup 0.38). In camAt, this is the only change among the 12 shots. |

## Findings, ranked by score gained

1. **The near sand at the spawn (A, dusk-fire; x 0–1, y 0.56–0.86).** *Regression (A).*
   - The NNW key lit the near slope: A is 82.7 against 55.6, and dusk-fire 80.3 against 73.4. The two mockups disagree
     on this same ground, but now both overshoot.
   - Fix: cut the key's gain on the near sand, or the crest-band graze boost (`sandGraze` × 0.9). Stop when the two
     views straddle their mockups (their mean is 64.5; ours is 81.5). Check on the clean patch.
   - Then fix A's left third (x 0–0.3, y 0.38–0.48: 93–114 against ≤ 47) with form, not light. The crest line put
     its shade at the right.
2. **D's hand and the plait (D, also C and h3; x 0.25–1, y 0.55–0.86).** *Regression (D), repeated (glove, sheen).*
   - Fix the hold: keep the fist at r9's height (`HD_GLOVE` y −0.23 to −0.25), so it stays clear of DODGE / JUMP in D.
     Get the rings rising from the bottom edge, which A to C show, from the loops (lower centres, larger `ry`), not by
     lowering the glove.
   - The plait: take the crown albedo back down and put the brightness in a specular crown (lower roughness plus the
     viewer light), toward coil p99 ~110.
   - The glove: it needs folds at hand scale with a real normal amplitude. Two rounds of crease octaves moved fine detail
     by 0.2.
3. **The late-dusk land (D, C, B; the clip).** *New, ledger-5 should-fix (below).*
   - Replace the camera-distance fade with a form term: darken faces turned away from the glow, with `uDusk`, and keep
     the crest rims lit, so D gets bands (12 / 50 / 12), not a flat 25–30.
   - Restore readable dunes in the late-dusk clip (ground 7 now, 40 in r9).
   - B's land (75 against 39) needs the same at dusk 0.5, where the fade gives only 31 %.
   - Widen D's afterglow (79 → ~120 rows over 100) and take its hue toward 214,161,129.
4. **The caravan halo (B, h2; x 0.40–0.70, y 0.38–0.52).** *New (a side effect of R9B-9).*
   - Put depth testing back on and bring the halo to lantern size, placed in front of the canvas opening. Light the
     tailboard and the arch's inside with the existing `fireLight` slot, not a 2.4 m additive card.
   - Target the wagon front near 58 with the lantern's peak kept.
   - Then lift B's near sand back toward 39: the late fill cut overshot to 31.
5. **The spawn sky (A, dusk-fire; y 0.10–0.36).** *Regression (sky box), repeated (cloud finish).*
   - The new glow term (`pow(toward, 9) * 0.5`) and the larger banks pushed both boxes 15–19 over their r9 values, away
     from their mockups.
   - Lower the glow gain toward ~0.35. Give the banks crisp streaked edges (the fine octave's weight back, and a
     narrower `cov` smoothstep).
6. **C's fire and smoke (x 0–0.55, y 0.0–0.47).** *Repeated, improving.*
   - The core is at 21 % of the white-hot area: denser licks, and logs that show.
   - Add the grey-brown billow drifting up-left. The region is bare sky now.
   - Take the post to iron (R/G 5.3 → ~2.3).
7. **A's landform (x 0–1, y 0.36–0.56).** *Repeated since round 1, part-fixed.*
   - The crest line reads as a dune from the spawn, and its lee edge is right. A still lacks the mockup's receding lit
     diagonals at x 0.3–0.8, and its left third is lit where it should be in shade.
8. **The aerials: the crisp terminator stamps hard dark ovals on hollows** (aerial-overview: lower left, lower right and
   right middle; aerial-spawn: a round pit at the crest line's south end). *New, nit.*
   - Fade the terminator ramp's sharpness with distance from the camera, so far hollows shade softly.
9. **Process: quote numbers measured at the capture SHA.** *Repeated.* The README's late-sand figures were from
   e2dec8b5e, and B's is 4–5 off at 0ae71b2a.

## Ledger-5 audit

- **Views: no breach.** camAt is identical for all 12 shots except dusk-fire's direction (0.17 → 0.136). That re-aim
  moves the tower onto the mockup's x (≈ 0.37 against 0.38) and is named in the README.
- **The crest line (26f691035): real, walkable, global terrain, so no breach.**
  - In the captured bakes it lifts the ground by up to 5.64 m over x −28..26, z −44..21. Its steepest cell is 35.2°,
    under the 40° climb. The spawn → tower trail crosses it at 22.2° max. The navmesh is re-baked, and the README
    reports walk 0 stuck.
  - No camera moved.
  - It is visible from h1 and both aerials, and in A, dusk-fire and h1 it reads as a dune: a shelf, a crisp brink and a
    shaded lee.
  - Red-team notes:
    - **It is a terrace, not a free-standing ridge.** Across it at t 0.65, the windward side is level with the slope it
      leans on (10.1 / 10.2 / 10.0 / 9.9 / 9.8 m over 16 m), and the lee falls into the old trough.
    - **It reads as a pit from the air.** Its lee is a hard-edged dark triangle ending in a round dark pit, more crater
      than dune.
    - **It was placed for mockup A's composition** and has not yet delivered it (macro r 0.20).
  - Its steep side faces ENE. I checked whether that is reversed against the field. The field's steep faces run both
    ways (west 2 446 cells, east 2 148), so it is consistent.
- **The far-land darkening (ed3c17393): a world effect, not tied to the mock cameras. A should-fix under "no narrowing",
  not a void.**
  - It keys on `uDusk` (quest state) and on the distance to whatever camera renders, in the shared sand shader, the fog
    colour and the ring haze. It applies in every view in the late dusk, and the clip shows it.
  - It is a fade to black around the camera, not lighting: 0 % at 8 m, 75 % by 60 m.
  - Its 8 m start sits just past the seats' clean patch: from D's eye that patch spans ~3–5.6 m. The commit message
    names the patch as the reason ("the seats' clean patch, under 8 m, unchanged").
  - It lowered D's land mean (47 → 38) without drawing its bands (macro r 0.33 → −0.13). That is a fog hiding a form
    gap.
  - It turned the late-dusk orbit's dunes black (ground 40 → 7). From the tower deck in the late dusk (the signal-fire
    climax), every visible dune is past 8 m.
  - Not void: the mockups B–D do want near-black far land, and it is shipped, global and reached by play. It should
    become a form-based term (finding 3).
- **The caravan and keeper-lamp halo (3b2f5f0e2): should-fix.**
  - `lampGlowMaterial.depthTest = false`, `frustumCulled = false`, additive, at 2.4 m on the caravan and 2.6 m on the
    tower's keeper lamp. It is a card drawn over geometry that occludes it: through the wagon, and through dunes from any
    angle where the lamp is hidden.
  - In B and h2 it stands in for lit cloth.
  - HEAD has since cut the caravan's to 0.9 m, with depth testing still off. That is outside this capture and not
    scored.
- **Staged state: unchanged and reachable.**
  - No staging code changed, and `duskOf` is the same: B 0.50, C 0.74 → about 0.80 when shot, D 0.86 settled.
    `fillAt` 0.15 → 0.05 changes the look at those values, not the state.
  - Round 9's reachability analysis holds: any lighting order, the whip's reach.
- **Global look: no per-view switches.** The key, terminator, sky, clouds, fade, fire, halo, cargo self-light, hold and
  plait are all shard-wide. The cargo's raised emissive is a self-lit prop so it "reads in the dusk": nit, global.
- **No narrowing, besides the above:**
  - h1 shows the crest line and a brighter dune band (86 → 103) under the NNW key.
  - h2's canvas is washed (75 → 105).
  - h3's coil covers the brazier's plinth.
  - The clip's late land went black (above).
- **Device and HUD: no breach.** 390×844 phone and touch, stored 780 wide; the baseline HUD in every view; a 30 fps chip;
  `active: []`; `pageErrors: []`; 58 programs. D's fist now sits under DODGE / JUMP: a hold change, not a HUD change.
  This surface has no frame-time or total-memory trace, so those budgets are unverified, not breached.

SCORE signal-dunes: 6.4
