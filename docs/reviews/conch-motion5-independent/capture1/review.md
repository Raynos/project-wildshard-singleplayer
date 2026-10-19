# Independent actual-recording review: Conch motion5, capture1

## Decision

**Retain as bounded, unaccepted WIP; reject promotion to accepted animation/runtime/collider status.** Combat plumbing and stable weighted ground proximity are useful progress. They do not close interrupt continuity, target timing, or readable animation. No four-star claim is supported. This review changes no production host, source, pin, or Site; the public motion4 host remains the baseline.

## Exactly what was inspected

The original 402×874 portrait WebM is SHA256 `730f29e7f535027eac5e2f1d31022cd9f202ae994c9f65d3219d2989338044de`. Independently decoded all **13,012 encoded frames, zero-based f0–13011, actual PTS 0.000–520.440 seconds**. ffprobe PTS were compared frame-for-frame with both recorded PTS lists. All 272 original sheet hashes and contiguous encoded-frame ranges were verified.

Visual inspection was chronological row-major contact-sheet inspection, not real-time playback and not full-resolution inspection of every frame. Every tile preserved the entire portrait at 100×218 pixels; fine weapon and joint detail needs the selected original-size checks below.

- f0–4801: viewed every tile of representative boards 0–99, 4,800 representatives. Two adjacent duplicate frames were represented by their byte-identical neighbour, not separately displayed.
- f4800–13011: viewed every tile of original sheets 100–271, including the final four tiles. This overlaps the first range by two frames.
- Union: complete encoded-frame overview f0–13011, without gaps. Original sheets 0–99 were hash-verified but were replaced for visual review by the representative boards; they are not claimed as separately viewed.

`inspect.py` streamed raw RGB24 through memory, compared adjacent complete 402×874 RGB buffers using exact byte equality, then SHA256-hashed each. `pixel-map.json` maps **every** encoded frame to an exact run and preserves all frame hashes. It found only nine exact adjacent duplicates globally: 13,003 representatives, so lossy-codec near-duplicates were never silently deduplicated. Only the early two duplicate substitutions were used for visual coverage. No approximate/perceptual deduplication or temporal sampling underlies the complete overview. Regenerable representative JPEGs were removed after inspection to preserve limited disk; no full-frame cache was made.

Separately decoded from the original movie and actually viewed at original 402×874 size: f710, 730, 753, 780, 1265, 1272, 1290, 1450, 1480, 1510, 1550, 10080, 10085, 10093, 10100, 10110, 10125, 10140, 10400, 12150, 12360. The 21 PNGs and `detail-map.json` preserve this selected detail inspection. These are sparse detail checks, not a claim that intervening frames received original-resolution inspection.

## Visual findings

The orange/cream shell, broad shield, small red legs and pointed rapier form a recognizable character silhouette against the dark arena. No catastrophic mesh explosion or gross stretching was visible in the complete overview. The shell/shield dominate changes in pose; the narrower weapon and torso action are comparatively difficult to distinguish. In full-detail ordinary windup/active/recovery checks, red vignette and HP loss communicate the hit more strongly than the rapier motion itself. The large diagnostic overlay also competes with play information.

Enemy hits produce a conspicuous nearly white whole-body flash. Full-size f1272 and f1450 confirm that it obscures material and fine pose at the very moment interrupt readability needs them. Repeated returns toward the same stance feel limited in expressive range. This is a captured visual judgment, not a controller-latency playtest.

Death: f10080 is recover; f10085 visibly labels observation1297 and still recover under lethal white flash/red hit marker. f10093 labels observation1298, now idle/death pose, with the rapier shifted. Subsequent full-size checks show the body rotating/collapsing; f10140 and f10400 show a stable settled corpse, shield forward and sword to the side. The original resolution supports the changed sword configuration, while the exact yaw magnitude comes from pose telemetry.

The two boundaries must remain distinct: actor death occurs at observation1297 with living poseInput retained (`deathT=-1`), recovery persists for that render; first dead pose occurs at1298. Rapier-arm yaw jumps **0.5899314048013247 rad at1297→1298**, not at1296→1297. Lethal contact was recovery clock1.2, despite the attempted-stage label. It does not cover active lethal continuity. No player HP loss occurs across the80 dead observation rows.

Opening loading/diagnostic frames and final scene-unload/loading tail were included. Full-size f12150 shows HP0 and f12360 HP100 after reset; I did not visually establish a distinct defeat modal or the Retry click itself from the overview. The raw actual-capture checks, separately, report reward/Retry/storage success. They must not be described as independently seen modal interactions.

## Coverage and limits

Raw trace:1,654 rendered observations,269 events. There are17 complete uninterrupted ordinary strike cycles and one complete uninterrupted counter. There are also15 ordinary cycles whose phase sequence reaches idle but includes hit/death interruption; “complete phase sequence” is not “uninterrupted.” `cycle-ranges.json` contains all33 phase-complete ranges with exact observation endpoints and wall-clock times. The table below identifies the18 uninterrupted cycles. All lie within the complete movie overview; trace wall-clock seconds are explicitly not movie PTS, and no guessed offset is used.

| Kind | Observation range | Trace wall seconds |
|---|---:|---:|
| ordinary | 36–52 | 25.8675–29.8879 |
| ordinary | 75–91 | 36.2840–42.6236 |
| counter | 145–161 | 56.4353–60.8233 |
| ordinary | 175–191 | 64.1774–68.3993 |
| ordinary | 658–674 | 187.8623–190.9362 |
| ordinary | 728–744 | 206.7161–211.5697 |
| ordinary | 783–799 | 222.4964–230.0114 |
| ordinary | 828–845 | 241.5888–247.2787 |
| ordinary | 900–916 | 269.9842–273.7995 |
| ordinary | 965–982 | 287.0179–292.1571 |
| ordinary | 1030–1046 | 305.2000–309.0073 |
| ordinary | 1381–1398 | 420.7713–424.6513 |
| ordinary | 1414–1431 | 427.3015–430.3958 |
| ordinary | 1447–1464 | 433.5991–436.7921 |
| ordinary | 1481–1498 | 440.7947–444.5017 |
| ordinary | 1514–1530 | 450.7360–458.8494 |
| ordinary | 1547–1563 | 465.7514–469.1651 |
| ordinary | 1580–1596 | 472.5023–476.9059 |

174 clock-zero stun observations and12 repeated hits during flinch are recorded. Missing: collision-qualified guarded windup .10/.20, counter preparation .215, a true stopped sample (the two attempted stop samples retain speed .85), and active lethal contact. These remain missing even though the whole movie was inspected. Source-level guarded .20 discontinuity (~.36631rad) and active-death risk (~.8rad) remain untested by their required runtime scenarios.

## Fresh weighted world-contact check

Reran the existing audited `qa-conch-motion5-contact.mjs` independently against the raw capture, not its previously computed result. This is an independent execution of the supplied algorithm, not a newly implemented independent skinning algorithm. It checks canonical packed geometry and identity before/after, reconstructing each vertex with all four weights: meshWorld × bindInverse × sum(weight × boneWorld × inverseBind × bind × vertex), then actual per-observation world-ground subtraction.

7,338 vertices,94 blended vertices; all1,654 rows processed. Minimum clearance0.002999999999815m; maximum of per-row minima0.004977697014965m; zero frames below−.005m and zero lacking a vertex within±.02m. The72 settled-corpse rows have minimum .003m. `fresh-contact-summary.json` retains per-row minima, identity and canonical-geometry checks, and the hash of the fresh full output (large regenerable full output removed). This establishes weighted mesh proximity to ground, not collision acceptance, planted-foot realism, or natural corpse contact distribution.

## Independent five-point assessment

Scale:1 poor,2 limited/WIP,3 serviceable in tested scope,4 strong,5 exceptional. No rating is a product-wide certification.

| Axis | /5 | Scope and reason |
|---|---:|---|
| Overall animation |2|Readable broad stance/collapse, but small attack differentiation and unresolved interrupt boundaries.|
| Ordinary attack choreography |2|Windup/active/recover exist; weapon intent is weaker than hit effects.|
| Hit/interrupt readability |2|Flash confirms contact but masks the pose; required interrupt clocks missing.|
| Death transition |2|Recognizable collapse; retained living recovery and first-dead-pose yaw discontinuity prevent acceptance.|
| Settled corpse stability |3|Stable in this view and weighted-ground samples; only one death route.|
| Locomotion/stop |unrated|No true stopped sample; recording cannot certify stop/start quality.|
| Combat readability |2|HP/vignette are clear, fine blade/guard timings are not consistently legible.|
| Graphics |3|Character silhouette/material contrast serviceable; sparse diagnostic arena only, no broader environment judgment.|
| Gameplay |2|Observed attack/damage/reward/reset loop functions; narrow diagnostic encounter, not a full-game playtest.|
| AI |2|Basic repeatable ordinary/counter states visible; tactical variety, navigation robustness and broader encounters untested.|
| Balance |unrated|Scripted placement, retries and targeted contacts cannot establish fair difficulty or tuning.|
| Estimated fun |2|Low-confidence viewing estimate: recognizable duelist, but repetitive limited readable variation; no hands-on fun validation.|
| Static likeness |unrated/separate|No fresh concept-reference comparison performed; animation scores cannot establish likeness.|
| Phone performance |unrated|This is a contended cloud capture, not phone testing.|

## Cadence, isolation and release scope

Rendered observation interval median240.4ms, p95653.5ms, maximum4396.6ms (1,625 same-bout intervals). The25Hz encoded frame stream is not25 rendered FPS. Bellback Blender overlap was explicitly recorded near capture start and Colossus Blender overlap from14:20:53; this contaminated run cannot establish mobile performance or intrinsic game-frame timing. Smoothness/response judgments require an isolated new run.

Actual capture checks report real combat/reward/Retry/empty stores passed, no page errors; required-target coverage remains false. Mounted-run1 failed obsolete navigation before Start and is not a mounted pass. The separately coordinated new wrapper retry is outside this review; its existence does not retroactively pass run1.

## Hash and pose closure

`hash-verification.json` records direct SHA256 checks against raw run-summary for the original movie, trace, events, geometry, old weighted-contact result, sheet index, actual report, mounted-run1 report, frozen source manifest, build pin, host receipt and preview; encoded-frames hash also matches the actual report. `identity-closure.json` is a fresh read-only identity call validating138 host files, exact validated product/native tuple, frozen inputs, packed payload, and asserted candidate pose. Runtime/visual/animation/interrupted-continuity acceptance all remain false. `pixel-map.json` independently checks all PTS and272 sheet hashes; the frozen source manifest is not a substitute for movie evidence.

Recommendation: preserve this evidence and use it to guide a bounded next iteration. Close the four missing runtime targets, distinguish actor/pose death boundaries in assertions, improve blade/guard/impact readability, and repeat an isolated capture before promotion. Do not replace the public motion4 baseline on this evidence.

Identity terminology: run-summary `source` (`be09cb6b…`) is the validated product `build.sourceHash`, confirmed equal to preview `sourceHash`; it is not the factory file digest. The factory TypeScript SHA256 is `3c1925fc70f12f51119d6cbad06a6d9709eed0ec6c5eeef9aa20f714ccf0d2ac` and matches its frozen manifest. The product-source hash was equality-checked, not independently regenerated by rebuilding.
