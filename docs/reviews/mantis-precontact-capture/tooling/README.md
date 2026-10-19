# Candidate7 capture tooling (not executed)

Prepared 2026-10-19. `scripts/qa-mantis-precontact-motion.mjs` is source-only checked. No application build, browser, visual rating or candidate acceptance is supplied here.

## Exact release gate

The coordinator must supply CAPTURE_SOURCE (reviewed source commit), CAPTURE_PRODUCT (preview sourceHash), CAPTURE_PREVIEW_SHA256 (SHA256 of the built mantis-preview.json), MANTIS_QA_DIST (frozen app directory), and MANTIS_QA_OUT (new evidence directory). Optional MANTIS_QA_PORT defaults to4487. The harness refuses missing pins, reused evidence directories, non-motion7 receipts and product/receipt mismatch before launching anything. The coordinator must separately verify the app build closure against its receipt. Run only when explicitly released through `scripts/browser-lane.sh`; never a dev server. All failures and raw video/trace stay in their new evidence directory, outside this source-only folder.

## Observation contract

- Successful candidate6 supplement/moving routes are reused; every new Retry animal/species is passively wrapped before its update. Each wrapper forwards the original call once.
- The animator's actual input is copied BEFORE evaluation: attack, t, boutTime, dt, phase/gait, speed, deathT, flinch, stage, observed phase/clock, tactical clock and all memory. No runner-clock reconstruction.
- Render rows retain bout/pose identity, exact runner snapshot/specification, full root world matrix, every bone's position/quaternion/scale/local/world matrix, camera matrices, health, render cadence and actual clocks. Damage events record authoritative clocks; their pose reference is explicitly the last evaluated pose, not a fabricated damage-time evaluation.
- The full-body portrait diagnostic camera is render-only and restored immediately. The overlay has pointer-events:none. Browsers are muted, iPhone16Pro portrait. Complete video must be reviewed at normal speed for full visibility/readability; numerical gates cannot establish those qualities.
- No AI, health, damage, time or RNG edits. Every diagnostic player placement is logged. Defeat uses inward placement near walls, retaining the successful supplement correction.
- No per-sample fulltrace serialization. Samples are small; complete traces drain at phase boundaries, end or failure. Capture deadlines bound attempts, never convert missing observations into passes.

## Planned sequence and honest gates

1. Real first/second windup, active, recover and subsequent stage2, with real player damage. Stop after observed completion or retained60s deadline failure.
2. Separate Retry bouts request early/late first-windup normal attack input. A hit is classified using its actual runner windup elapsed (<.375 early, >=.375 late), never the requested timing. Missed windows remain failed coverage; no assertion that arbitrary interruption is reachable.
3. Proven first-active moving-kill approach (at most10 inputs/75s), then8s settle. Require a genuine lethal event, prelethal speed>.1, deathT0 and1 samples, settled tail and bout-local reward.
4. Reward Retry, natural player defeat with inward player-only placement (180s maximum), blocked attack while defeated, defeat Retry, reload and fresh entry. Compare empty browser/state stores at lifecycle boundaries.
5. Every post-entry render must have finite evaluator-owned attack and matching bout identity. Functional success never changes qualityAcceptance=false.

Read the complete artifacts before claiming success. Cadence, render/video alignment, all missing samples and all failed checks remain disclosed. The previous early-knee failures are untouched. Reload is a fresh UI/storage smoke; its short post-reload segment does not claim new pose-observer coverage.

## Source validation

`node --check scripts/qa-mantis-precontact-motion.mjs` and installed oxlint on that exact file pass. First lint failures (shadowed callback names and an index style check) are preserved in lint-first.txt; no runtime was started.
