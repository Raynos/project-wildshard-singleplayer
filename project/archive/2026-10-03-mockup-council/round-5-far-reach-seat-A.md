# Round 5, seat A — Sky Reach

Lens: game art director. Read COUNCIL.md, the frozen ledger, brief, scores, all three round-1 seats, both round-2
far-reach seats, and all three far-reach seats from rounds 3 and 4 fully. Reviewed the five supplied round-5 sheets,
the five ledger mockups and matching game JPEGs at full resolution, first-frame, h1–h4, both aerials, and clip.mp4
sampled at two-second intervals. This round directory contains five Sky Reach sheets; Signal Dunes receives no score.

Evidence: `progress/far-reach/20261003-0033-9dbf50f8/`, captured commit
`9dbf50f82c70f005b5988c2f44a4376bce0db30b`. Source checks use that commit, not the builder's subsequent working-tree
edits. The committed camera blob is `fe325fc8dec4ca0c0e5f9eaebc7f360a4993b681`, matching meta.json.
Regions below are fractions of each portrait picture, excluding the sheet title: x left→right, y top→bottom.

The same setting is recognizable, but its finish and composition differ immediately. No frame reaches the brief's
8, where the differences require looking for. Scores judge the supplied pictures, without credit for effort or progress.
The round-4 ruling excluding C's stone span remains applied; the established baseline HUD is retained.

## Sky Reach scores

| Mockup → game view | Score | Biggest difference 1 | Biggest difference 2 | Biggest difference 3 |
|---|---:|---|---|---|
| `round-11-review/mockup-A-spawn-look.jpg` → `mock-A-spawn-look` | 6.5 | **Sky and islands, y .12–.52:** the target has dense gold-edged clouds and a broad overlapping, irregular island cluster with long hanging roots. The game has open lavender sky and separated, regular tapered islands with conspicuous green caps. Its pale mill, bright pines, rear house and land stack remain evenly readable instead of stepping into golden backlit haze. | **Meadow, x 0–.60, y .65–.86:** the target's fine intertwined grass, shaded bases, sunlit tips, small flowers and lichen rocks become exposed yellow-olive ground, blunt dark tufts and tall stems with large round flower heads. There are no comparable foreground rocks. | **Bridge and fan, y .46–.77:** the bridge axis and wrapped posts identify the scene, but the deck has thick repeated wedge ends and a solid dark near edge, with smooth orange ropes in deep unsupported curves. The fan's plain brown fittings, dark clean leaf and simpler grip lack the target's worn fabric, rib highlights and convincing leather finish. |
| `round-18-council-mockups/mockup-B-quest-start-painterly.jpg` → `mock-B-quest-start` | 6.0 | **Sky and destination, y .16–.58:** the target's open, substantial cumulus and smaller dark timber mill on a narrow spur become prominent floating islands, a large pale stone mill, rear house/land stack and cyan pane. The massing and depth are different. | **Keeper and lectern, x .08–.43, y .43–.63:** the keeper and quiet brown scarf are recognizable, but the arm points stiffly and his face/clothing have less articulation. The red-brown board on thin legs offers no clearly readable open book; the lantern sits on the ground instead of hanging from the target's substantial carved stand. | **Foreground, y .60–.86:** pale upright blades and dark stubs over visible flat ground replace low golden meadow, irregular rocks and daisy patches. The fan spreads farther into the central foreground, with flat fittings and weaker fabric/leather detail. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly.jpg` → `mock-C-hands-fan` | 5.5 | **Principal subject, x .25–1, y .49–.82:** the target's large diagonal fan carries riveted metal guards, engraved end caps, creased cloth, gold edge glints, a convincing gripping glove and long tassel. The game has a smaller right-side spread with plain brown guard sticks, thin ribs, a clean darker leaf and short tassel. | **Approach, x 0–.65, y .48–.86:** although the eye is back at meadow height, the near post still dominates the inner left third and the deck crosses from the left edge. Cloud, cliff and a smooth green rise occupy most of the foreground instead of a flowered grassy verge with a rough lower-left rock and bridge receding into the centre. No deduction for the excluded stone span. | **Sky and mill, y .12–.57:** the target's large warm cumulus banks and dark weathered mill become a lavender open upper sky, prominent nearby islands and pale tower right of centre. The exposed sun and rear stack further change its isolated silhouette. |
| `round-11-review/mockup-D-crown-arena.jpg` → `mock-D-crown-arena` | 6.0 | **Roc and storm, y .16–.45:** the target eagle banks across nearly the entire width, showing layered slate-and-white feathers, turned head and talons forward. The game is a smaller symmetric frontal bird with brown wings and tucked feet. The storm's pale eye remains beneath the bar; the target's dark coiling eye sits above it. | **Arena, x .05–.95, y .48–.66:** the target's broad near carved dais sits before rough lichen stones with large subdued runes. The game has a thin distant platform with unreadable compass, regular slabs and small bright raised spirals. | **Meadow and horizon, y .46–.86:** pale flat patches and blunt repeated tufts replace the target's lush rocky grass. Beyond the stones, warm haze replaces layered cloud sea, distant islands and pines. The central-right sun and large fan also occupy areas the target leaves open around its low-left sunset. |
| `round-1-proposals/B-sky-reach.jpg` → `mock-proposal-B` | 5.0 | **Composition, whole frame:** the target looks down a centred receding bridge from a substantial grassy knoll to a small isolated mill isle. The game looks across a deck entering from the left toward an island filling almost the whole width; foreground ground is reduced to a thin strip above the bottom HUD. Standing on the knoll does not reproduce the target camera. | **Destination and sky, y .12–.72:** the large pale keel cone and long stalactites, wide deck, pines, rear house and stacked land differ strongly from the target's smaller dark rooted spur. Nearby islands crowd the top rather than receding at varied depths; the large manta and glowing trail beside the mill are absent. | **Close finish and atmosphere, y .43–.86:** the target has worn thin slats with gaps, tied rails, rocky gold meadow and a lower fan with fine material detail. The game shows chunky wedge-ended boards, simple smooth ropes, much more open cloud, and the same flat brown fan fittings. Its brighter orange cloud sea does not supply the target's shaded grassy approach and pale atmospheric depth. |

**Sky Reach seat score: (6.5 + 6.0 + 5.5 + 6.0 + 5.0) / 5 = 5.8.**

## README claims checked

| Claim/change | Verdict and evidence at the capture commit |
|---|---|
| Grade saturation .32 / contrast .24, bloom .55 from threshold .7 | **Implementation verified; target result partial.** These values are in `manifest.ts:29`. Exported A/B/C/proposal highlights rise somewhat, but the frame still lacks the target's luminous cloud, vegetation and object edges. A red channel above 230 is not equivalent to bright luminance. Measurements below do not establish the stated 10–20% versus 16–19% claim; the README supplies neither its region nor its brightness definition. |
| Rim about 45% stronger; hotter sun core | **Verified in source.** `look/light.ts` changes rim RGB from [1.8,1.22,.7] to [2.6,1.7,.85] (channels increase by different amounts); `look/sunGlow.ts` raises core 2.4→3.2 and halo .6→1.0. The sun is conspicuous in D/proposal B, but the foreground still does not share the target's shaded bases and bright grazing rims. |
| Sun about 9° up just right of the windmill | **Verified:** `PANO_SUN` is heading 7.56°, elevation 9.30°. It is visible to the right of the mill in C/proposal B. The target A/proposal sunset is low-left; one shared sun should be judged as a shared compromise, not moved separately for each shot. |
| Panorama middle sky warmed to peach | **Partial visual match.** The committed panorama changes, and A/B's measured red rises. C's upper patch remains distinctly cooler than its target; proposal B's patch is darker and more orange than the target's pale air. Warming the mean has not reproduced the cloud masses or atmospheric separation. |
| Darker ground under blades; olive-gold meadow, B (99,85,34) vs (96,80,50) | **Source change verified; quoted colour not reproducible without its patch.** `world/isle.ts` darkens the ground multiplier and `world/meadow.ts` changes the blade grey mix. On the earlier seats' ground patch, B is now (85,72,26), target (88,74,47). A and D also remain much yellower. Exposed ground, blunt tufts and pale long blades remain the dominant visual problem. |
| Flowers in tight drifts | **Implementation verified; finish partial.** `meadow.ts` multiplies two drift fields and changes flower probability. A/B show grouped flowers, but individual large circular heads and straight stems still dominate instead of the target's small flowers within intertwined sward. |
| Rim crags and code root cones removed from playable isles | **Verified:** `DRESS.cragsPerIsle` and `rootsPerM` are zero. The brown/green upright rim blocks are gone. This does not remove the broad pale shelf at the textured keel's upper join or give the keel the target's dark irregular rooted silhouette. |
| B's sky and keel shapes unfinished | **Confirmed in the frames.** B retains A's prominent island cluster where its target has open cumulus; proposal B retains the huge regular pale cone. |
| KNOLL/proposal-B moved; C back on meadow; Roc on its circle | **Changes verified and named.** See the audit below. They repair specific earlier process defects, without establishing that these compositions match their targets. |

Measurements decode the original JPEGs, with no grading or image alteration. Sky: x .18–.82, y .17–.33; ground:
x .03–.38, y .68–.82. Highlight region: x 0–.62, y .08–.85, the region used by earlier seats, excluding right-side
controls. Luminance is .2126R + .7152G + .0722B on decoded 0–255 RGB. Patch means include everything in the patch.
C's ground patch includes deck/ground; proposal B's includes cloud, so neither is a meadow measurement.

| View | Sky RGB, target / game | Ground RGB, target / game | Luminance p99, target / game | Luminance >230, target / game |
|---|---|---|---|---|
| A | 198,154,125 / 185,157,134 | 81,67,39 / 101,85,21 | 242.5 / 221.7 | 3.46% / .06% |
| B | 200,167,152 / 184,156,135 | 88,74,47 / 85,72,26 | 218.7 / 220.8 | .33% / .11% |
| C | 203,163,141 / 181,162,162 | 97,80,43 / 101,75,38 | 239.8 / 223.4 | 3.07% / .11% |
| D | 133,104,99 / 148,114,113 | 86,71,42 / 101,85,29 | 246.1 / 219.4 | 4.54% / .10% |
| Proposal B | 207,191,182 / 178,144,106 | 74,67,37 / 206,169,154 | 240.8 / 223.9 | 6.06% / .10% |

These support the visible highlight gap, not a requirement to chase one global pixel percentage. In the same region,
counting *any RGB channel* over 230 instead gives game percentages 10.79/12.34/16.66/6.83/19.00 and targets
22.11/8.72/23.23/22.56/19.62. The threshold's meaning matters; saturated orange alone can raise that count.

## Ledger §5: cameras, reachable states and shortcuts

- **Camera notes are accurate.** Camera blobs change only proposal B's x 5→7.6, z −11→−11.5, yaw 5.4→8.
  `KNOLL` moves to (7.6,−11.5), and meta.json records proposal's actual eye at (7.6,33.09,−11.5), C at
  (3.2,31.7,−11), and the other listed poses exactly. C is outside the knoll's 4 m footprint and back at ordinary
  meadow eye height. Its raised-eye defect is resolved. The recorded positions expose the remaining composition
  failures: proposal lacks the target's foreground knoll and centred bridge; C lacks its flowered verge and left-margin
  post. I found no demonstrated camera change hiding a weak bridge surface, but these are not yet the target viewpoints.
- **The knoll is a player-supported place.** `world/knoll.ts` builds the cap and hull; `world/build.ts` registers the
  hull as grass. Moving it is a global geometry change, not a camera-only rise. Two nearby HERO_STONES rows were removed
  globally; the resulting proposal foreground is mostly cloud, not the target's finished meadow. Their removal does
  not earn credit for reproducing the target's rocky knoll.
- **D's outside-orbit placement defect is resolved geometrically.** `plugin.ts` now requests offset
  (−3,−sqrt(13²−9)), exactly radius 13 around DAIS/ROC. It is on the declared circle, rather than beyond it. The README
  correctly names the staging commit. `stageStalk` uses the real first-phase brain state; the capture sets calm false
  and allows 300 ms of normal motion, retaining the real wing animation and timed lightning. This is a plausible ordinary
  approach, not the earlier extended stalk-line justification. However, “a spot every lap passes” is stronger than the
  code proves: normal flight steers toward moving orbit targets. No normal-play trace or post-settle bird state/position
  is recorded. The helper can still silently return unless fighting in phase 0. **Remaining verification:** record live
  state, phase, fighting flag and position at the frame, and capture an ordinary approach or show a normal-play trace
  through the staged approach. The new camAt records the camera, not the bird. No demonstrated flattering staging breach
  is established by this surface; D's exact-state certification remains incomplete.
- **h4 quest-crown milestone is reachable.** Notes, roost clearance, vanes and winch complete the quest and raise the
  bridge before the separate boss. QUEST COMPLETE plus a live Roc is legitimate. The unchanged helper's whole-world
  caveat persists: it sets the roost-cleared flag without retiring those enemies. Complete traversal/staging evidence
  should include normal quest side effects; these remote enemies provide no observed advantage in D.
- **Fan pose is reachable and held.** C has no stage, and `WarFan.ts` uses the ordinary leaned HOLD with normal idle
  animation. No frozen GUST or omitted attack effects were found. The fan is also present in D; do not hide it solely to
  reproduce the target's open arena foreground.
- **Real 3D and HUD:** the bridge, posts, playable islands, textured keels, knoll, mill, keeper, fan, Roc and arena are
  meshes. The aerials and sampled clip show their depth. Painted sky/cloud/storm scenery is distant atmosphere; no
  painted replacement for walkable foreground geometry was found. All scored frames retain baseline touch HUD.
  Full-health VITALS hiding and target-dependent LOCK are baseline behaviour, not screenshot cheats.
- **Phone configuration verified; shipped identity and budgets remain evidence gaps.** Captured recorder uses
  390×844 @3, phone tier/touch, resized to 780×1688 JPEGs; metadata reports zero page errors. It does not verify the
  caller-supplied SHA against the served production build or measure frame-time distributions and total loading/Explorer
  memory. The 30 fps label and clip encoding prove neither 30 fps performance nor 1.8/1.0 GB limits. Attach the existing
  identity, budget and normal-play results before certifying a pass. No over-budget result is asserted here.
- **No narrowing:** the hero/aerial views and orbit show the wider route still present, with no obvious new visual
  regression beyond the named layout tradeoffs. They do not test the full quest, collision traversal or boss fight.
  This surface cannot certify their regression status. No score-voiding screenshot shortcut was demonstrated.

## Findings ranked by visual return

These continue the earlier open art gaps and check the current changes; all art rows are `should-fix`. No new content
beyond the targets is proposed. The separate staging/build/budget verification gaps above remain open.

| Rank / ID | Mockup and frame region | Concrete fix |
|---|---|---|
| 1 / R5-A-SR1 | A/B/D foreground, y .60–.86; C/proposal approach | Replace the visible flat floor and blunt tufts with intertwined narrower curved blades, varied lean/height, dense low thatch and shaded bases. Put warm light on tips and small daisy clusters among irregular lichen rocks where the targets show them. In D, break the rows and pale patches; in C/proposal, build a substantial flowered grassy approach rather than trading it for open cloud. Colour averages alone will not fix these forms. |
| 2 / R5-A-SR2 | A/B/C sky and scene, y .12–.60; proposal destination; D highlights | Match the shared light hierarchy through the actual look and final output: shaded camera-facing surfaces, luminous gold rims, stronger warm cloud edges and haze separating depth layers. Check the tone mapper/post chain before increasing saturation again; the captured `look/render.ts` returns the clean engine chain without a shard fx override. Measure the exported frame, with an explicit region/brightness definition. Warm C's cloud masses and give proposal its paler air; preserve one coherent sun. |
| 3 / R5-A-SR3 | Proposal whole frame; C x 0–.65, y .48–.86; A bridge/destination | Complete the real approach layout and target viewpoint: grassy high ground on the bridge axis, deck receding to a smaller isolated destination with cloud around it. C needs the post nearer the left margin and meadow before it. Correct cameras only toward those compositions and document actual eye positions. Reshape the broad destination lip/rear stack where needed; preserve traversal. No excluded stone span. |
| 4 / R5-A-SR4 | C fan x .25–1, y .49–.82; all lower-right viewmodels | Build riveted metallic guard plates and engraved caps, lacquer highlights on ribs, worn/creased teal cloth, a longer tassel and articulated gripping fingers with folded sleeve/bracer. Give C its larger diagonal presentation through an ordinary held pose/input or real action with effects. Keep the grip clear of controls across the shared play view. |
| 5 / R5-A-SR5 | A/C/proposal bridge and keel, y .43–.75; A/B upper islands | Thin/weather the planks, remove repeated wedge ends and the solid near slab read, expose slat gaps, and add actual tied hemp/support detail. Integrate the remaining pale shelf into an irregular rocky lip. Reshape the huge cone into the target's darker rooted spur; arrange real decorative masses into A's overlapping cluster while keeping B/C's cloud sightlines as open as the shared world permits. No per-shot visibility switches. |
| 6 / R5-A-SR6 | D Roc/storm, y .16–.45 | Capture a verified ordinary closer approach with the existing motion/effects. Refine the real eagle rig/model into a banked body, turned white head, forward talons and separated slate flight feathers. Rework the shared storm projection so the dark eye occupies the upper region and gold cloud depth lies below; reduce the competing central-right halo rather than moving the sun only for D. |
| 7 / R5-A-SR7 | D dais/stones/horizon, y .48–.70 | Make the dais top broad and legible before the stones, with carved compass/joints and irregular weathered rim. Engrave large subdued spirals into rough lichen stone instead of small glowing tubes on regular slabs. Expose layered cloud/island/pine depth between the stones through the actual surrounding scene. Preserve the ordinary fan/HUD. |
| 8 / R5-A-SR8 | B keeper/lectern x .08–.43, y .43–.63; proposal beside mill | Finish the quest-start focal props: substantial carved lectern, clearly open book, hanging lantern and relaxed open-palm wave with worn cloth/leather layering. Keep meadow/rocks behind the keeper. For proposal, align the existing manta's ordinary flight depth and capture timing so its gliding silhouette/trail appear beside the mill, as the target shows; no pasted creature or capture-only teleport. |

SCORE sky-reach: 5.8
