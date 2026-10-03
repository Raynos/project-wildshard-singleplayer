# Mockup council round 16 — Signal Dunes — seat A

2026-10-03 · Codex · game art director lens · bar **7.0**.

Surface: `art/mockup-council/round-16/README.md`, its five Signal Dunes sheets, the five original ledger mockups, and all twelve stills and `clip.mp4` in `progress/sunscar-dunes/20261003-0918-232dbb40/`. Code and terrain checks below use capture SHA `232dbb408ef03e719eecbebee87c803af05e9097`, not the shared working tree. Round 15 comparisons use `progress/sunscar-dunes/20261003-0835-c1b820c3/`. Read against COUNCIL, ledger, brief, scores and the requested earlier seat files. Sky Reach is not scored.

**Visual mean: 6.44, reported as 6.4/10.** The scene is recognizable, but its main forms and finish still differ at first glance. The late clip is substantially repaired, B's glow returns, and middle-distance ripple contrast improves. Those gains do not replace A's missing golden crest or turn the glove into the mockup's grip. A and dusk-fire now present one large shaded face where the targets separate several dunes.

**Ledger finding: the remaining grain fades do not meet the lead's clarified mean-preserving exception.** This is a brightness-by-distance term under the round-16 restatement in `scores.md`; I flag the surface for void/re-run under that rule. The numeric score describes picture likeness, not eligibility to pass. This is not a claim that the removed 70% late-darkening term returned; the evidence and magnitude are different (finding R16A-1).

## Scores

Regions are fractions of the complete portrait frame, with the origin at top left. Each row lists its three largest differences.

| Mockup | Score | Three biggest differences, with frame regions |
|---|---:|---|
| A — `round-9-review/A-spawn-dusk-light.jpg` | **6.1** | **1. Landform and light:** x 0–1, y 0.34–0.57: one broad dark face crowds the tower and removes the bright diagonal crest and overlapping dune shoulders. **2. Sand finish:** x 0–0.65, y 0.56–0.84: grain is closer, but illumination lacks the target's raking copper highlights and small relief; the middle face reads uniformly shaded. **3. Hold:** x 0.27–1, y 0.60–0.85: a compact upright rope oval and exposed finger stack replace the large loose coils and mostly occluded grip. |
| B — `round-9-review/B-quest-logbook.jpg` | **6.9** | **1. Caravan finish:** x 0.38–0.76, y 0.40–0.51: pale smooth cloth strips, flat red boards and chunky wheels lack the dark weathered canvas, folds, wood wear and concentrated lantern modelling. **2. Sky and backdrop:** x 0–1, y 0.22–0.50: the glow is restored but still subdued; the smoke is a thin curved wisp rather than a broken central plume, and the land under the glow is too bright. **3. Camp integration:** x 0.25–1, y 0.47–0.58: regular boxes and cylindrical sacks, weak contact lighting and patterned ground make the camp feel assembled rather than settled into the sand. |
| C — `round-9-review/C-waymark-fire.jpg` | **6.8** | **1. Flame:** x 0.24–0.51, y 0.24–0.46: long flat orange/cream tongues lack the dense turbulent white-hot fuel core, broken edges and billowing smoke; sparks predominantly travel right. **2. Brazier:** x 0.26–0.49, y 0.44–0.57: ornate twisted post and blocky tapered plinth differ from the rough straight support and irregular stone drum. **3. Ground/depth:** x 0–1, y 0.47–0.69: the light pool is broader and paler, distant land is brighter, and the target's localized granular firelight is weaker. |
| D — `round-9-review/D-hands-whip.jpg` | **6.3** | **1. Grip and leather:** x 0.30–1, y 0.62–0.85: fingers face the camera, the upright handle sits beside the coil, and leather lacks creases and seams; the target presents a closed grip's back and cuff with the handle inside the loop. **2. Dune bands:** x 0–1, y 0.49–0.68: rounded brown swells replace transverse dark layers and a thin illuminated near rim. **3. Rope silhouette:** x 0.27–0.70, y 0.63–0.85: the small regular oval and visible trailing cord differ from the target's irregular loop and cord disappearing behind the grip. |
| dusk-fire — `round-2-dunes/C-dusk-signal-fire.jpg` | **6.1** | **1. Dune composition:** x 0–1, y 0.35–0.70: the near shaded wall obscures the separate tower mound and descending lit shoulder; the saddle is too dark. **2. Sky:** x 0–1, y 0.15–0.36: purple sky and soft peach cloud smears replace restrained amber-grey clouds and fine warm filaments. **3. Signal silhouette:** x 0.18–0.62, y 0.20–0.40: the target's large ray above a squat occupied tower and visible flame are absent from this moment; the game has a narrow open cage and a tiny light pin. |

Mean: `(6.1 + 6.9 + 6.8 + 6.3 + 6.1) / 5 = 6.44`. This seat remains below Jake's 7.0 bar; the passing decision uses the three seats' mean.

## Rec. 709 measurements

Image measurements use decoded JPEG RGB on a 0–255 scale: **Y = 0.2126R + 0.7152G + 0.0722B**. Originals are resized once with Lanczos to the stored game's 780×1688. These are display-image luminance comparisons, not linear scene radiometry. No clipped red channel or max-channel proxy is used. Values below are **mockup / round 15 / round 16**. Normalized boxes match the table's coordinate convention.

| Region / measurement | Mockup | R15 | R16 | Reading |
|---|---:|---:|---:|---|
| A bright diagonal, x .40–.70, y .40–.44: mean Y | 96.5 | 48.5 | **32.0** | The intended illuminated crest is now darker still. |
| A shade below crest, x .50–1, y .48–.54: mean Y | 42.5 | 75.0 | **29.6** | The pale sheet is gone, but shade overshoots. |
| A right of tower, x .60–1, y .36–.46: mean Y | 55.1 | 59.8 | **33.7** | Direction of the builder's reported reduction reproduced. |
| dusk-fire right of tower, same box: mean Y | 46.6 | 78.0 | **34.6** | Close to the reported 35; now below target. |
| dusk-fire left shoulder, x 0–.35, y .50–.70: mean Y | 82.9 | 69.6 | **66.5** | The target's bright approach shoulder is missing. |
| dusk-fire saddle, x .35–.90, y .46–.56: mean Y | 54.6 | 74.2 | **33.1** | Correcting pale sand made a broad dark barrier. |
| B right glow, x .72–.90, y .40–.47: mean Y | 87.6 | 35.5 | **61.2** | Real recovery, incomplete match. |
| B wagon front, x .45–.60, y .41–.47: mean Y | 58.3 | 53.7 | **47.6** | Caravan modelling and local light remain weak. |
| C far land, x .60–.90, y .48–.53: mean Y | 16.1 | 24.2 | **26.8** | Honest removal of darkening exposes a remaining terrain/light gap. |
| C fire pool, pixels x 150–450, y 1060–1150: mean Y | 40.4 | 52.4 | **48.5** | Slight improvement, still broad and pale. |
| D left transverse land, x 0–.50, y .52–.62: mean Y | 16.0 | 14.8 | **36.1** | Restored stand reveals lit swells instead of dark layers. |
| D near lit band, x 0–.40, y .64–.68: mean Y | 58.7 | 35.4 | **36.0** | The narrow bright rim has not been authored. |

The clean near-sand box is pixels **x 10–150, y 1160–1400**, clear of hand and controls. Fine detail is mean `abs(Y − GaussianBlur₂(Y))`, measured by blurring RGB before the luminance conversion:

| View | Near mean Y, mockup / R16 | Fine detail, mockup / R16 |
|---|---|---|
| A | 57.2 / 62.0 | 9.4 / 8.1 |
| B | 39.8 / 31.4 | 2.0 / 2.9 |
| C | 32.9 / 36.7 | 0.16 / 1.72 |
| D | 35.8 / 32.0 | 0.18 / 1.37 |
| dusk-fire | 75.3 / 64.5 | 9.8 / 7.7 |

A's middle ripple contrast, `mean(abs(blur₁Y − blur₅Y))/mean(Y)`, at x .10–.60, y .48–.56 is **5.8% / 18.1% / 6.3%**: the contrast fix holds. That does not establish the correct macro form or brightness.

For the 10×7 grid of mean Y across full width, y .36–.58, correlation is A **−.154 → +.462**, dusk-fire **−.326 → +.148**. These are positive gains, but not an exact reproduction of the README's +.50 / +.25; it does not specify its precise ROI/filter. Correlation alone misses A's 32 versus 97 illuminated crest.

C's flame box, pixels x 150–450, y 520–900, has **5,212 / 3,455 / 1,420 pixels above Y 230**, and **2,483 / 186 / 0 above Y 245**. This frame has a weaker hot core. Fire code was not changed in this batch; the global LUT and animation phase can change these measurements, so they are not evidence of a deliberate fire-code regression.

D's corresponding leather crops (mockup x .76–.97, y .69–.80; game x .66–.82, y .68–.77) give median Y **24.4 / 38.2**, p95 **83.8 / 63.3**, fine detail **9.0 / 3.4**. The game has lighter leather with less tonal relief, not the target's dark leather with sharp worn highlights.

## Builder claims checked

| README claim | Verdict and evidence |
|---|---|
| Late far-land term removed; every remaining distance fade is zero-mean | **Removal true; blanket zero-mean claim false.** The 70% late term is absent. The generated grain tile averages **0.490867824**, not 0.5; its three distance-faded albedo octaves retain a negative mean. See R16A-1. |
| Wind flipped; key and sheen unchanged | **True at the captured source.** WIND reverses from (.643, −.766) to (−.643, .766). KEY remains normalized (.39, .20, −.90), intensity 2.05; sheen is unchanged. |
| Crest is round 15's line, slip face toward camera, 30 m wide | **Width/side true; same line false.** R15 control points were (−68.8,−37.8,25), (−17.1,5.6,18.5), (34.6,49,12); R16 uses (−46.9,−60.8,20), (14.4,−9.3,23.5), (75.7,42.1,27). Points moved about 32–42 m and the height trend reverses. Those are real geometry changes, but need accurate disclosure. |
| Pale sheet removed; lit-sand saturation .64–.66 | **Pale sheet removed, similarity only partly improved.** The right-of-tower Y reduction reproduces. Selecting the brightest 15% of sand-band pixels, y .38–.58, gives saturation `(max−min)/max`: A **.668 / .408 / .542**, dusk-fire **.673 / .343 / .468**. Different unspecified selection could explain the README's numbers; they do not characterize the visible band measured here. |
| Middle ripple .7 → .26; near amplitude unchanged | **Source change true; A's middle contrast now close.** The near endpoint stays .52; actual near luminance/detail still changes with geometry and the global grade. |
| B mound 26 → 21; waymark 0 rise 24; waymark 1 lift 10 restored | **True.** The captured bake puts waymark 0 at 24.00 m and waymark 1 at 15.82 m. The restored lift does not restore the former 41–44° cliff; independent bake measurements below pass. B's skyline/glow benefits. |
| Back of fist/cuff now face camera; fingers around handle; fall behind hand | **Transform/material edit true, visual claim false.** RotY is −.4, leather is lighter/glossier and loop plane turns toward camera. Visible fingers remain front-on; handle remains beside the loop; trailing cord is exposed over the ground. |
| D restored to round-14 stand; other camera directions unchanged; no dusk/stage change | **True.** D returns to (38,122), yaw 21.7; other camAt directions and all 72° FOVs match R15. Ground-eye shifts reproduce the README. `plugin.ts` staging and `dusk.ts` are unchanged; the generated staging-commit list indicates a touched handler file, not an actual handler edit. |
| LUT shipped; painted skies and fire flipbook parked | **True on this capture.** `loadLUT('sunscar-dunes')` is global, fitted on the R15 frames. This surface includes the LUT. The parked uncommitted sky/fire work gets no credit. The LUT's fitted prediction is not a current-frame similarity measurement. |

## Findings, ranked

| Rank / ID | Mockup and region | Concrete fix |
|---|---|---|
| **1 — R16A-1 · must-fix, ledger** | All sand, especially near-to-middle ground and the late clip | **Make allowed detail fades actually preserve mean brightness.** Reconstructing `sandGrainTexture()` exactly over its 256² byte tile gives R mean **.490867824**. The three camera-faded expressions `(texture.r − .5) * 1.8`, `* 1.3`, `* 1.6` therefore have means **−.01644, −.01187, −.01461** at full strength: together **−.04292**, fading to zero by 40 m. The paired glint expression also averages **−.005104**, before its .9 gain. Pairing opposite thresholds is not zero-mean on an asymmetric histogram. These are average albedo changes; **4.29% is not a measured final-frame Y change**. Here farther ground becomes brighter, unlike the removed late cut, but the clarified rule prohibits any brightness change by camera distance. Center each octave and glint on its actual mean, or use footprint-filtered world-space detail without these distance envelopes. Verify the final lit material on the same world patches at several distances, including bump-normal effects and the LUT; then recapture. The +.2228 ripple correction alone does not validate the other terms. |
| **2 — R16A-2 · highest visual gain** | A x .20–1, y .34–.57; dusk-fire x 0–1, y .35–.70 | **Separate the dunes and expose the illuminated crest.** Rework the real crest's height profile, ends and slip-face extent so the spawn eye sees a bright diagonal ridge above a shaded face and a separate tower mound, with the dusk-fire shoulder descending into a readable saddle. A's intended crest is Y 32 versus 97, despite the better correlation. Test the baked shadow with the key inside the afterglow, the actual 23.05 m eye, aerials and approaches. Do not solve this with another distance cut, an A-only look, or a camera move. |
| **3 — R16A-3** | All holds; D x .30–1, y .62–.85 first | **Finish one convincing common grip.** Rotate/condition the hand so its back and cuff dominate, close the fingers around the handle, put the handle inside the hanging coil, and let the tail disappear behind the grip. Preserve leather creases, seams and dark recesses; uniform tint and gloss do not replace the missing detail. Judge the resting and attacking hand in play, then all five crops. Do not create a D-only pose; the earlier one-hold allowance remains. |
| **4 — R16A-4** | C x .24–.51, y .24–.57; ground x 0–.65, y .54–.68 | **Model the fire and its support as a hot fuel bed with turbulent volume.** Break the long continuous tongues into layered irregular flames, a concentrated luminous core around visible fuel, broken smoke billows and scattered embers. Use the target's rough straight post and irregular stone drum rather than a polished twist and trapezoid. Concentrate orange ground light around the base instead of the broad pale pool. Retain normal completion notices, smoke and timing. |
| **5 — R16A-5** | A/dusk-fire sky y .15–.36; B plume/glow y .22–.47 | **Replace soft cloud smears with the target's varied cloud structure.** Author fine warm filaments, darker broken banks and depth around the sunset band; dusk-fire needs restrained amber-grey clouds rather than peach puffs against purple. Keep one sky and the real monotonic dusk progression. Painting at infinity is permitted; parked assets are not part of this result. |
| **6 — R16A-6** | B caravan/camp x .25–1, y .40–.58 | **Weather and light the caravan locally.** Add canvas folds, dark seams, torn edges with depth, worn timber and readable wheel construction; integrate cargo with contact shadows and varied placement. Give the lantern a concentrated pool on boards, cloth and nearby sand, and a broken smoke plume. Keep the restored skyline opening, but make the land beneath the glow a dark physical backdrop rather than a bright strip. |
| **7 — R16A-7** | D land x 0–1, y .49–.68; dusk-fire tower x .18–.62, y .20–.40 | **Finish the actual world silhouettes.** Author transverse dune layers and narrow lit rims around D's real stand; the near rim is Y 36 versus 59. Give the tower its readable platform, occupied silhouette and visible keeper flame. Let the real flying ray's route supply a comparable overhead silhouette through normal timing, rather than freezing it above the tower for the shot. Check these from surrounding walks as well as the fixed camera. |

## Ledger 5 and play-state audit

- **Camera disclosure passes.** D's 30.09 m real-eye move is named and restores the R14 camera; it improves the intended distant tower scale without hiding a forbidden stand. Other directions/FOVs are unchanged. The h3 eye rises 11.53 m with its real waymark terrain, not an elevated camera rig. Ground cameras are about 1.70 m above the captured bake; h4 is the tower deck.
- **Reachable terrain passes this check.** Decoding the capture's 256² height bake and bounding bilinear-cell gradients at all four corners gives maximum **39.28°**, no cells over 40°. Within 50 m of waymark 1 the maximum is **34.90°**. Straight-line sampled grades are spawn→D **15.82°**, spawn→waymark 1 **13.35°**, spawn→waymark 0 **24.23°**, C→near waymark **2.79°**. These corroborate reachable terrain; they are not a new navigation/combat playtest.
- **A and dusk-fire are ordinary initial state.** The small keeper light is present before the signal milestone. Neither frame stages a completed signal fire or suppresses its associated fight.
- **B's `logbook` state is reachable.** The handler applies Sefa's initial flag and the normal dusk progression while leaving the logbook unread. Its wait allows that dusk state to settle. At approximately 22 m, no local READ prompt is expected: the interaction radius is 2.4 m. Do not fabricate the mockup's closer prompt at this distance.
- **C and D's `waymarks-lit` state is reachable and keeps effects.** The handler invokes normal logbook/well/oil/brazier interactions and lights all three; it does not merely set a screenshot flag. C captures fresh completion notices, flame, smoke and sparks; D's longer wait lets the notices expire. The quest permits any lighting order, so a player can light the near waymark last and back to C. C is about 11 m from that bowl; the heavy's 8 m reach plus 1.2 m bowl radius leaves about 1.8 m to back away across nearly flat ground within the 3 s settle. The ordinary resting whip can be held; no frozen attack pose is credited. The signal fire and matriarch are correctly absent at this milestone.
- **No painted walkable geometry or per-shot look found.** The landforms are baked geometry, the LUT is global, and the hold is common. The aerials and hero views show continuing terrain beyond the five views. The recorder calms creatures (`active: []`); this surface therefore does not establish combat quality, but it is not evidence that combat was deleted or changed to improve these stills.
- **Late darkness regression is repaired.** At ten clip samples, t .5–9.5 s, mean Y across full-width ground y .55–.90 is R15 **3.1–6.0**, R16 **24.1–31.1**. Across y .30–.90, pixels below Y 5 fall from **52.9–87.4%** to **.17–.39%**. Forms remain readable through the clip. This is distinct from the smaller nonzero-mean grain-fade breach above.
- **HUD/device capture passes; physical budget evidence is incomplete.** Phone/touch framing and baseline controls remain; no hiding notices or manufacturing old ammo/health/journal UI to imitate a mockup is requested. Meta reports zero page errors and no QA retakes. The recorded GPU ceiling changes 109.750→109.887 MB at the earlier LUT parity SHA, not a complete performance reading at 232dbb40. Total device memory and measured phone frame times are absent: unverified, not a demonstrated budget breach. The HUD's 30 fps label is not an independent performance measurement.

**Disposition:** visual likeness remains 6.4. Correct and verify the biased detail fades before a passing round can be accepted under the lead's round-16 brightness-by-distance rule; then re-run the surface. Preserve the real late-play repair while addressing the landform and grip gaps.

SCORE signal-dunes: 6.4
