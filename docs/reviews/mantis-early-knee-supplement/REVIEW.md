# Same-product instrumentation and defeat supplement

2026-10-19. Acceptance remains HOLD. No rebuild, gameplay change, health/damage injection, AI/clock/RNG change or public promotion. Original failed main run and tooling remain unchanged.

## Why this bounded supplement

The main run's fixed-angle player placement eventually put the player beyond the room's ±50m wall (actor z49.36, player z50.22). Real canReach uses wall line-of-sight; damage stopped and health regenerated. Candidate5 used the same placement recipe but reached defeat before actor z40.57. Its recorded host-source inventory exactly matches the current host, with zero differing files. This is strong wall-blocking evidence, not an inferred gameplay regression.

Root authorized one small same-product supplement. The new harness transparently attaches observation functions before each original PracticeCreature.update, retaining original ordering, arguments and return values. Every new species created by Retry is observed. The frozen original product1411a8ac1dbbbc08e9da4e3857ac9b369de248e491a23ba25566279842a59996 and all served files rehashed unchanged. Only diagnostic player placement changes: beyond20m from arena center it faces inward. All placements and aim operations are logged. Full trace serialization is periodic/final rather than on every sample.

## Actual outcome

-13/14checks pass; preserved exit1 is solely movingLethal=false. The one genuine post-Retry enemy death was stationary (prelethal speed0), rather than the intended moving case. Do not relabel it. The main run separately retains a genuine moving death at prelethal speed3.2725 with full transforms but without pose-owned inputs.
- Actual player health reached0 through normal enemy attacks. Attack while defeated did not damage the enemy. Retry restored enemy55/player100 in immediate render history; reload/reentry also restored those values. Actual practice3-coin reward and empty unchanged browser/world stores pass. No page errors or fatal exception.
- All807render poses have exact pose-owned inputs, including after Retry and the lethal boundary. Five scalar/pose differences correspond to actual applied-hit frames46,58,66,77,87.
- At lethal frame87, boutTime5.816000000029798: the actual animation input was alive=true, deathT−1, flinch.004865187613967884, while later rendered lifecycle state was alive=false, deathT0, flinch1. At frame88 the pose-owned and post-state values match: deathT.125, flinch.5769498103804866. This directly records the first-death post-hit mismatch rather than replaying the skeleton with the wrong scalar values.
- Every exact native weighted vertex clears the floor at all807observed poses. Overall minimum+2.046408mm; dead-pose minimum+6.333302mm. This does not certify unsampled intervals or collider/contact robustness.
- One whole402×874VP8video,107.96seconds,2,699encoded frames at25fps. Median render interval98ms, p95 251.7ms, maximum1035.9ms. Cloud cadence and encoded duplicates are distinct from physical-phone performance.

Independent complete-frame and native-contact review is still required. No third capture is proposed by this report. Source formulas, numerical clearance and successful lifecycle checks do not confer animation, collider, physical-phone or human-fun acceptance.

## Reproduction and evidence

Run scripts/qa-mantis-early-knee-supplement.mjs through scripts/browser-lane.sh against the exact existing tmp/mantis-early-knee-dist-capture1 build. Use the same installed browser/environment recorded in the main run's REPRODUCE.md; set MANTIS_QA_OUT to a new directory. The supplement's strict static server uses loopback4477. No package installation or app build is required or performed.

tooling-freeze.json pins the syntax/type-aware linted harness before recording and references the unchanged built closure. summary.json retains every hit, authoritative strike episode, exact pose/state difference, cadence and failed check. video-probe.json records the complete encoded stream. evidence-closure.json pins all original raw trace/hit/aim/report/video/screenshots, exact native contact reconstruction, new editable harness and reused analysis tools. All paths are repository-relative; all original failures remain accessible under their existing main-run closure.
