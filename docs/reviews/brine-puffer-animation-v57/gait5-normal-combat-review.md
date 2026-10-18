# Gait5 normal combat frame review — 2026-10-18

## Decision
Bounded animated-WIP promotion is defensible when combined with the faster gait5 stop/resume continuity review. This normal-rendering check found no new gross reset hop or tearing during actual repeated hits. It does not establish polished motion, planted feet, reliable floor contact or phone performance.

## Inspection scope
Every encoded frame F285–640 inclusive was manually inspected: **356 frames**, PTS 11.40–25.60 seconds, at 25 fps. Fifteen numbered sheets represent 353 exact decoded RGB groups, including three duplicate-frame pairs. These hashes are not distinct rendered poses. Additional native-frame checks used F304, F359, F428 and F488. Intro/loading and frames outside this interval were not manually reviewed.

Source: `page@79f799ff1e8034441eecd40c3ef5f77e.webm`, normal post-processing and shadows enabled, 390 × 844, 1× cloud. No bypass rendering was used in this recording. Telemetry has 99 samples, about 4.50 observed Hz, median sample gap 213.35 ms, maximum 716.6 ms. Long held poses and uneven jumps are apparent in the actual images; 25 fps encoding does not make this a 25 fps animation-quality test.

## Actual events and findings
- First damage appears F304, overlay 7.913, HP45→33; the next begins F359, overlay9.038, HP33→21. Third nonfatal flash begins F392, matching telemetry10.9959, HP21→9. The lethal flash/defeated HUD appears F428, overlay12.044, HP9→0. Telemetry records flinch1 for each event. Overlay timing was inspected directly and is not a fixed video-PTS offset.
- Repeated hit flashes wash out the surface and weapon swings obscure the center. Visible feet and body remain connected after the flashes; there is no obvious new large foot-only hop, open root gap or stretched polygon tear. This rules out a gross visible regression in this capture, not all sub-frame discontinuities.
- Recoil remains difficult to read through the flash and low cadence. Do not infer smooth reset blending from the small number of rendered states. The prior higher-cadence stop/resume gate is separate evidence.
- Death continues from F428 through the whole-body toss/roll. The mesh moves coherently as a whole; large vertical motion is consistent with the existing death throw plus bone pose, not evidence by itself of a gait-floor guard failure. Later corpse frames F503–559 show a stable rolled pose before Retry. The close framing, HUD overlap and weak contact cues prevent proving exact floor contact or all rear/tail attachments.
- F469 shows collection of two local practice coins. F560 begins the visible fresh-bout Retry reset; the remaining inspected frames show the living opponent again. Builder telemetry separately reports restored player health and empty storage. No new combat functionality claim is inferred solely from animation images.

## Evidence closure
`gait5-combat-frame-map.json` records all inspected frames and RGB hashes. `gait5-combat-clip-receipt.json` records the original source hash and genuine compact clip: `public/review-evidence/puffer-animation-v57/gait5-normal-hits-death-settle.mp4`, F285–559 inclusive (275 frames, 11.00 seconds), ending before Retry. Original timing is retained; no interpolation or speed change. Original recording remains unchanged.

The earlier report correctly said that the first gait5 diagnostic never hit the enemy. This separate recording closes the gross repeated-hit regression gap, with the low-cadence limits above. No static likeness score or animation score was changed.
