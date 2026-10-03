# Round 7 — seat A — Sky Reach

Lens: game art director; resemblance to the frozen mockups, with no credit for effort or progress.

Read: `COUNCIL.md`, the frozen `ledger.md`, `brief.md`, `scores.md`, all round-1 seats and all round-2–6 Sky Reach seats. Surface: the Sky Reach section of `art/mockup-council/round-7/README.md`, its five comparison sheets, the five original ledger mockups, and `progress/far-reach/20261003-0250-1c2c026e/`: all five full-resolution mock views, first-frame, h1–h4, both aerials, metadata and clip samples at 0/2/4/6/8 seconds. Source checks refer to capture SHA `1c2c026e14b21063895f31ce8f7c27d99678c3d6`, compared with round 6's `fc54d9df`. Later working-tree changes are outside this score.

Regions below are fractions of the individual portrait frame: x left to right, y top to bottom, including HUD. The score respects the exclusions for C's stone span, baseline HUD differences, and proposal B's accepted camera/visible near deck. No bridgehead hill is requested.

## Scores

| Mockup → game frame | Score | Three biggest differences, with regions |
|---|---:|---|
| `round-11-review/mockup-A-spawn-look.jpg` → `mock-A-spawn-look.jpg` | 6.0 | **1. Island silhouette and depth (x 0–0.9, y 0.23–0.49):** the mockup's large, overlapping, rooted island cluster above the mill is absent. The game has open sky and cropped islands at the edges. Moving the overhead islands far away helped the other views but removed a defining subject here. **2. Meadow (x 0–0.65, y 0.63–0.85):** a smooth mossy floor with isolated flower stalks replaces dense backlit blades, daisies nestled in grass, and grey lichen rocks. This is visibly sparser than round 6 immediately ahead of the player. **3. Mill/bridge finish (x 0.08–0.95, y 0.3–0.65):** the pale, regular stone tower and bright conical pines lack the mockup's weathered, backlit mass; the net has repetitive straight bars and the exposed island wall remains regular. Thinner planks and rope ties are visible improvements, but do not reach the target finish. |
| `round-18-council-mockups/mockup-B-quest-start-painterly.jpg` → `mock-B-quest-start.jpg` | 6.5 | **1. Keeper and lectern (x 0.1–0.4, y 0.43–0.6):** a small, straight raised arm, simplified face and stiff coat replace a readable open hand and layered cloth. The larger stand is real, but its book reads edge-on above a box lip; the low lantern does not read as the mockup's hung lantern on a carved stand. **2. Ground and rocks (x 0–0.75, y 0.59–0.85):** bare moss patches and soft repeated tufts replace irregular blade drifts, flowers and articulated lichen rocks. The new foreground stones read mainly as green caps. **3. Mill and atmosphere (x 0–1, y 0.2–0.6):** the front-lit pale tower and even pine row differ from the dark, weathered mill on a rocky spur. The cleared sky is closer, but the left island crop and thin cyan ramp lines still intrude into the cloud field. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly.jpg` → `mock-C-hands-fan.jpg` | 6.0 | **1. Fan and hand (x 0.3–1, y 0.49–0.82):** the mockup's broad diagonal fan and substantial gloved grip dominate the frame. The game's smaller right-hand fan remains a clean semicircle with flat ochre guards and a tiny grip at the edge. Brighter silk, added studs and straps are visible at full resolution; the ornate squared caps, worn folds and strong rim highlights still do not read. **2. Sky (x 0–1, y 0.05–0.5):** lavender upper air and thin streaks differ from the warm, thick cumulus banks; the ring-edged sun sits behind the mill rather than providing the target's strong left-side light. **3. Verge and bridge material (x 0–0.8, y 0.47–0.85):** the post-left/deck-receding composition is sound and grass coverage is better, but the verge is brighter and more uniform, with fewer rocky interruptions. Straight net bars and a clean cliff face replace irregular hemp, wood and rock. The stone span is excluded. |
| `round-11-review/mockup-D-crown-arena.jpg` → `mock-D-crown-arena.jpg` | 6.5 | **1. Roc (x 0–0.9, y 0.23–0.39):** it remains a largely frontal, symmetric V with brown-and-cream underwings and tucked feet. The target is a banked slate-and-white eagle with separated feather layers, a turned head and talons extended forward. The revised heading does not create that silhouette. **2. Storm and sun (x 0–1, y 0.05–0.57):** the higher storm eye is readable, but bright violet/white swirls and the broad yellow wash below differ from the smoky slate vortex, broken gold cloud rims and sharper hot disc. A dark outline still encircles the sun. **3. Arena finish (x 0–1, y 0.51–0.85):** the near dais and compass pattern read, but clean polygon paving, thin standing stones and glowing cyan tube spirals lack the mockup's raised broken rock, cut runes and lichen. The foreground is still mostly moss and soft clumps; the added stones barely register. |
| `round-1-proposals/B-sky-reach.jpg` → `mock-proposal-B.jpg` | 6.5 | **1. Destination (x 0.12–0.9, y 0.29–0.57):** the windmill stands on a wide, regular shelf with evenly spaced pines rather than a small irregular spur on hanging rock and roots. Its keel is narrower than round 6, but the broad top and uniform edge dominate. This deduction concerns the destination, not the accepted near-deck visibility. **2. Sky and ray (x 0–1, y 0.05–0.56):** saturated orange/yellow cumulus replaces pale gold, silvery air and many cloud-sea depths. The ray and curling luminous trail beside the mill are absent in this matching frame, although rays exist elsewhere in the evidence. **3. Foreground and fan (x 0–1, y 0.56–0.85):** mottled moss, soft clumps and low green rocks replace a crisp flowered crest; the fan is higher and cleaner, without the mockup's wind curl. The camera stays on its approved rise. |

**Seat score — Sky Reach: (6.0 + 6.5 + 6.0 + 6.5 + 6.5) / 5 = 6.3/10. Below 8.** The same place is recognizable. The differences in foreground finish and the principal subjects are immediate, not details one has to search for.

## Brightness checks

Brightness throughout is decoded-image Rec. 709 luminance, **Y = 0.2126 R + 0.7152 G + 0.0722 B**, on the 0–255 scale. This is an image comparison, not scene-linear exposure measurement. No red-channel or max-channel value is used as brightness.

To reproduce the builder's highlight range, resize both originals to 390×844 and measure the full-width play crop, rows 60–699, as the repository measurement script does. Values below are mockup / round-7 game:

| View | Y p99 | Pixels with Y > 230 |
|---|---:|---:|
| A | 238.4 / 238.9 | 2.1% / 2.9% |
| B | 240.3 / 238.4 | 2.2% / 2.8% |
| C | 235.7 / 239.4 | 1.9% / 2.9% |
| D | 241.4 / 241.1 | 2.8% / 4.4% |
| Proposal B | 238.8 / 241.8 | 3.8% / 4.5% |

The README's 238–242 and 2.8–4.5% ranges are **verified for that crop**. They are not literally whole-frame ranges: including all HUD, the game's p99 is 236.6–240.1 and its proportion above 230 is 2.1–3.4%. Matching the upper tail does not establish matching cloud shapes, colour, backlight or grass highlights.

For subject/ground checks, resize all originals to 780×1688. Use the same normalized crop in all three images, mockup / round 6 / round 7:

| Region | Mean Y: mockup / r6 / r7 |
|---|---:|
| A subject, x 0–1, y 0.45–0.65 | 104.0 / 67.2 / 83.1 |
| A under bridge, x 0.25–0.75, y 0.53–0.60 | 108.3 / 70.2 / 86.0 |
| B subject, x 0–1, y 0.45–0.65 | 108.6 / 84.7 / 96.5 |
| C subject, x 0–1, y 0.45–0.65 | 96.6 / 112.6 / 130.5 |
| D subject, x 0–1, y 0.45–0.65 | 145.9 / 142.6 / 152.4 |
| Proposal B subject, x 0–1, y 0.45–0.65 | 124.4 / 69.5 / 86.9 |

The gamma lift is real. The exact quoted A “84→99” cannot be certified without the builder's region/statistic; my fixed subject region gives 67.2→83.1. Under-bridge 70.2→86.0 supports the direction and approximate size of the claimed 72→88 lift. C was already brighter than its target and the same global lift increases that mismatch.

Ground crop: x 0.03–0.38, y 0.68–0.82. Fine detail is standard deviation of Y minus Y from a 3-pixel Gaussian-blurred RGB image; a diagnostic of the visible result, not a stand-alone quality score. All comparisons use the same method/resolution. C's usual crop contains bridge/post, so its separate unobscured verge uses x 0.05–0.65, y 0.77–0.85.

| Ground | Y p10 / p50 / p90, mockup → game | Fine detail: mockup / r6 / r7 |
|---|---|---:|
| A | 38.8 / 60.5 / 107.7 → 58.2 / 70.8 / 86.6 | 20.0 / 14.2 / 9.0 |
| B | 39.8 / 65.8 / 125.5 → 47.9 / 66.7 / 94.5 | 21.4 / 13.2 / 10.1 |
| D | 35.4 / 62.0 / 126.4 → 39.5 / 61.5 / 99.3 | 22.1 / 14.7 / 13.7 |
| Proposal B | 35.0 / 57.3 / 111.3 → 51.7 / 72.0 / 97.2 | 16.3 / 10.2 / 11.8 |
| C unobscured verge | 35.8 / 66.8 / 126.1 → 55.8 / 89.8 / 125.5 | 21.6 / 12.5 / 16.9 |

A/B's compressed dark-to-light spread and lower fine detail agree with the crop inspection: larger atlas dimensions have not yielded a finer rendered foreground there. C's verge coverage improved, but its base is too bright and even. Colour also matters independently of Y: proposal B's sky patch (x 0.18–0.82, y 0.17–0.33) has mean Y **193.8 / 195.1**, almost equal, while mean RGB is **207,191,182 / 237,189,132**. The game's orange cast is still conspicuous despite matching brightness.

## Builder claims and listed changes

| Claim/change | Verification on this capture |
|---|---|
| One hot sun in gold-orange bloom; dome samples by view direction | The source now samples `world.xyz - cameraPosition`, and the previously separated hot spot/ring is substantially aligned. The core is brighter. **Partial visual pass:** the dark pink/orange perimeter remains, especially in D, and the surrounding wash is still much smoother than the mockup's broken illuminated clouds. |
| Near-ground darkening gone | **Verified in source:** the camera-distance multiply in `world/isle.ts` was removed. Do not carry forward round 6's claim that this particular multiply still exists. The ground's flat appearance persists for other reasons. |
| Finer, greener sward, arching blades, gold tips, fewer/smaller flowers | **Construction verified, result mixed:** atlas dimensions double, blades arch, flowers are reduced, and the 12-gon rim coverage correction is present. C gains coverage and visible detail. A/B lose near-ground blade texture; their surviving flowers still stand above a smooth floor. “Finer” is false as a blanket rendered-result claim. |
| Narrower windmill keel; netted ropes; thinner planks | **Verified:** the lower keel tapers more, plank depth decreases and vertical rope ties are added. The playable top is still wide, and clean repetitive net bars do not yet look like the target's irregular hemp construction. |
| Slate-and-white Roc; banks across the view | A recolour shader is present, but **the asserted appearance is not achieved:** visible underwings remain brown/cream and the body is frontal. The animation supplies symmetric wing flap and tail pitch; changing yaw alone does not supply body bank, head turn or extended claws. |
| Storm eye higher | **Verified:** lifted/advanced storm placement and a clear eye above the boss bar. Colour and cloud structure still differ. |
| Lichened rocks in B and D | **Assets/placement verified; weak image result:** B has visible low green stone caps; D's added stones are difficult to separate from its mossy floor. They do not yet reproduce the mockups' exposed grey rock, lichen and strong rock-to-grass boundaries. |
| STEP (-64, -126), outside B | **Verified for the step/house:** the source moves the playable island farther west and its house is no longer overhead in B. A different island edge still enters the left frame, and cyan updraft edges remain; “step out” should not be read as “all distractions removed.” |
| Larger book stand (8109cb927) | **Verified:** a box plinth, substantial square post and reading box replace the thin stand. Its orientation/lip hide the open pages from B, and the low lantern reads separately at the base. |
| Fan finish (part of 148b2e1c4) | Brighter silk, darkened ribs, guard plates, straps and studs are present; this was not an unchanged weapon round. Nevertheless its held silhouette and glove remain much farther from C than its new small details suggest. |

## No-shortcut / ordinary-play audit

| Rule | Evidence and verdict |
|---|---|
| Cameras disclosed and toward the target | A/B/C/proposal B retain round-6 mock camera positions, directions and FOV. D retains its aim/FOV; its settled eye rises about 0.04 m. Its settle changes 150→60 ms, explicitly disclosed. Hero h3 is re-aimed from 30° to 41° toward the moved step; this is in the camera source, not an undisclosed mock-camera substitute. Proposal B stays at the lead-approved rise. |
| Real foreground and geometry | The rises, island keel, planks, ties, stand and stones are actual scene geometry; the rises retain gameplay colliders. No pasted foreground, HUD alteration or per-shot material/visibility replacement was found in the checked changes. The infinity panorama remains an allowed background. |
| No narrowing to one frame / no regression | The overhead islands were moved globally into the distant horizon, rather than hidden only for a shot. That is an ordinary-world change, but it improves B/C/proposal B at the expense of A's defining cluster. A/B's near meadow also regresses visibly. These are cross-view regressions to fix, not evidence of a mock-only rendering switch. The aerials and clip retain the archipelago, but are not a full traversal test of the farther-west step and its longer connections. |
| Every staged shot reachable | A/B/C/proposal B do not use a named actor stage. h4 stages completed bridge quest flags; completing that quest while the separate Roc fight remains live is a plausible player state. D's `stageStalk` is guarded by fighting/phase 0, puts the Roc on its 13 m circle at flight altitude, enters the actual stalk state and permits simulation to advance. **The new exact heading remains unverified:** it is forcibly aimed at a point 14 m west of the entrance, while ordinary `stalk` steers toward the current player and the captured player stands on x=0. The circle point's plausibility does not prove this joint position/yaw/action at this player's approach. `meta.json` records the stage name, not that actor-state history; the supplied overview clip does not show an unstaged approach producing it. Record that trace before declaring the revised stage reachable. This is an evidence gap, not a demonstrated impossible pose or an automatic score void. |
| Animation/effects advancing | D is active with `calm: false`; the code triggers the normal storm strike and waits 60 ms. No animation freeze or removed transient effect is shown. A shorter settle is not itself a breach. The banking claim fails visually regardless. |
| Phone/HUD/performance/memory | Captures are the phone/touch setup and 780×1688 exports; baseline full-health VITALS suppression and contextual LOCK are accepted. Metadata reports 6 s load, 100 programs and zero page errors. The listed GPU-ceiling update is a parity/program-budget result, not proof of sustained iPhone 30 fps or the ledger's memory limits. This surface contains no such measurement; the fixed HUD “30” is not evidence. No invented performance/memory pass is awarded. |

## Findings, ranked by score gained

1. **Restore a blade meadow where the player actually looks** — A/B lower left and centre, y 0.63–0.85; D y 0.67–0.85; proposal B y 0.57–0.85; aerial-spawn rise. In `world/meadow.ts`, inspect the combined hole/path height multipliers, island grass scale, short-sward discs and the tuft card's sink/cull against the knoll surface. The A crop has flowers but almost no standing blades; do not answer that with another atlas-resolution increase. Keep trodden paths, but retain interlocking varied blades and dark roots around them, with flowers sitting in the sward. Expose grey, irregular lichen rock faces above the grass in the existing mockup positions. Keep the removed camera-relative darkening removed. Re-check A/B/C/D and the aerial with the same crops.

2. **Give the fan its target silhouette and material hierarchy** — C x 0.3–1, y 0.49–0.82, then A/B/proposal B. Change the normal held pose/scale so C reads as a broad diagonal fan with a substantial hand and layered glove. Preserve gameplay visibility. Replace the rounded ochre guard silhouette with the target's angular iron caps, make the straps/studs readable against lacquered ribs, and add leaf folds/wear and a restrained sun-facing edge glint. Inspect at phone resolution; details that only exist in source do not close this gap. Keep this the player's ordinary weapon, rather than a capture-only model.

3. **Recover A's island mass while keeping the other skies open** — A x 0–0.9, y 0.23–0.49; B/C/proposal B upper half. Reposition/reshape the existing sky islands into a hazed, irregular overlapping cluster visible from A, with rooted undersides, and evaluate the same global layout from all four viewpoints. Do not add a per-view hide. Warm C's high clouds and recover thick lit cumulus; desaturate proposal B toward pale silvery gold. Finish sun registration by removing the dark perimeter and concentrating the hot core, while distributing highlights to cloud rims and sun-facing object edges rather than widening yellow bloom.

4. **Make the Roc bank during normal flight, then capture that real action** — D x 0–0.9, y 0.23–0.39. Add body roll/head orientation linked to ordinary turning, with a credible forward talon pose during the shown approach/attack. Rework the visible wing underside toward the mockup's slate/white split and separated feather layers; the current shader's existence is insufficient. Verify under the crown's actual warm lighting. Supply an unstaged player-approach recording plus actor position, yaw, phase and action history; use its observed state to validate or replace the west-offset `stageStalk` heading. Keep live lightning and simulation.

5. **Weather the crown's stone and break up its light** — D x 0–1, y 0.5–0.85. Give the existing dais a fractured raised rim and less uniform paving; expose rough grey/lichen faces on the standing stones and make the spiral read as a cut rune rather than a cyan tube. Retain the readable compass pattern. Break the flat yellow space between stones with the mockup's lit clouds, hazed isles and silhouettes; retain the higher storm eye, but shift its white/violet centre and arms toward smoky slate with gold-edged cloud structure.

6. **Finish the keeper set and destination from the accepted cameras** — B x 0.1–0.4, y 0.43–0.6; A/proposal B mill island. Orient the existing book/reading surface so B sees open pages, lower the obscuring lip and hang the lantern where its attachment reads. Give the keeper an open waving hand and cloth volume. Break the mill island's regular shelf/keel contour and pine spacing, weather the tower and strengthen backlit silhouettes. Keep the bridge's thinner planks and ties, but vary sag/tie alignment and add readable rope twist. Do not move proposal B to a new bridgehead hill.

7. **Show the existing ray and wind language during ordinary play** — proposal B beside the mill, x 0.5–0.75, y 0.36–0.5; cyan lines at the spawn views' left edges. Time a normal ray pass near the mill, with a curling translucent wind trail like the mockup, and ensure the route naturally offers that sightline. Replace the updraft's bare straight cyan edges with the existing mockup's softer wind ribbon language, without removing the playable connection or hiding it for captures.

SCORE sky-reach: 6.3
