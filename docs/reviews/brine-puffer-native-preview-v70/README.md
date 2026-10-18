# V70 rig1 gait5 app-root evidence

Unaccepted WIP. Source checkpoint `207c95b5e13de559734610d06761eec1e1ae3ab6`; clean engine baseline `c4339d90a93ccc289540e3a72c1e9cbf221d98fb`. Exact native/admission/pose pins and the 137-file app inventory are in the receipts. V57 fallback is preserved.

Product and app builds passed. Real normal-render combat passed: opponent45→0 HP, two local practice coins, Retry100/100, empty persistence, zero page/HTTP errors. All four normal passes and shadows remained enabled at390×844/DPR1. This covers the cloud app root only; mounted-prefix Site QA remains separate.

The normal screenshot is an actual Retry frame with unchanged renderer. The diagnostic recording is explicitly labeled post/shadows off, not appearance evidence. Normal capture has211 actual rAF samples (~4.5Hz); diagnostic has1452 total,1413 after rendering simplification (~30Hz median). Encoded frames are not independent pose samples. Compact telemetry retains every rAF row, scalar and local bone value without rounding, omitting only world matrices, which remain in pinned raw telemetry.

## New actual-world contact failure

Reconstructing weighted V70 fin vertices with the captured actual world bone matrices gives minimum clearance−138.98mm at normal overlay t36.8172 during a living hit. Actor groundY remains900. Cap-to-belly error is0 and minimum triangle-area ratio0.6. The no-hit diagnostic has minimum clearance+4.00000019mm and area ratio≥0.68555.

The existing engine applies directional flinch tilt at the creature root (`animalRig.ts`, `applyAnimalRoot`), after local gait motion. The earlier1068-frame source audit covered the local pose, not this world-root tilt. Preserve both findings; do not treat the local pass as whole-game contact acceptance. No engine, gait, visual or collider acceptance is claimed. Independent frame review and contact correction remain pending.

## Replay and audit

Run product under `scripts/heavy-lane.py build`:
`node scripts/build-puffer-native-preview.mjs art/driftwood-isle/approved-puffer/v70-gait5-dimensions.json gait5 tmp/puffer-native-preview/v70-gait5 art/driftwood-isle/approved-puffer/v70-gait5-preview-candidate.json`

Then app under the same lease:
`PUFFER_PREVIEW_DIR=tmp/puffer-native-preview/v70-gait5 node scripts/build-puffer-native-preview.mjs --app tmp/puffer-native-preview-v70-gait5-dist`

The portable capture copies parameterize only the installed trusted browser path through `PUFFER_CAPTURE_CHROME`; original and portable script hashes are distinguished in each receipt. Run from the clean build root, through `scripts/browser-lane.sh`, with the installed Playwright/FFmpeg environment. They use local static HTTP servers, real inputs, and read-only pose telemetry; only the separately labeled diagnostic changes renderer passes/shadows.

The recorded-skin audit accepts only the exact weighted V70 native and one of the two exact raw capture hashes. Run `python3 audit-recorded-skin.py.txt <weighted-native> <raw-capture> <output>`; normal capture intentionally exits1 for failed clearance, diagnostic exits0. Its fixed900 floor is the isolated flat practice arena, not a general terrain test.
