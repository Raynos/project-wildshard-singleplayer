# Colossus lifecycle verification: rebuilt host, unchanged product

2026-10-19. **Lifecycle regression verification passes; corpse contact fails.**
This is actual isolated engine combat, not an art pass or arena-quality acceptance.

- Host revision: `e5f1e73d70550051fc1b4569d0df77bf7c514eb7`.
- Exact unchanged product source: `7a4c5bc237574a93d7b5b6f3325a53cf0141054aafc86082f497baff24d905a5`.
- Distinct new build: `tmp/colossus-native-preview-dist-build2`; old build1 preserved.
- V4-skin1-native22-motion1 unchanged. No mesh, animation, model, collider or engine edits in this verification.
- Existing headless shell, muted, iPhone 16 Pro portrait 402×874, cloud SwiftShader.
- `qa-colossus-native-observer-v2.mjs` uses explicit player/camera placement and normal sword input. No enemy/health/time/RNG edits. The temporary render camera is restored after each render.

## Actual combat and lifecycle

All 20 combat checks pass: the two sweeps, slam and exposure; real enemy and player damage; exposed sword damage of 18; enemy defeat; no post-death strikes; 35 bout-local coins; both Retry paths; blocked defeated-player attacks; clean re-entry; and empty unchanged global/shard/browser stores.

All seven additional lifecycle/identity checks pass. The enemy death event names `practice.tideRootColossus`; player death names `actor.player`. Four distinct actor instances and mesh UUIDs are observed, each starting alive at 480 HP in state 0. The stable actor ID is intentionally reused across bouts; mesh UUID and observed object identity establish replacement.

The first rendered dead row is frame 783 (state 0, deathT 0); frame 784 is state 6, after 0.1 game seconds / 166.6 ms wall time. All later dead rows stay state 6. This measures next-fixed-step delivery, not same-frame delivery. All 142 dead rows have idle strike phase. After player death, the surviving 480-HP enemy remains alive and never enters state 6 throughout the captured interval before Retry.

## Motion and actual cadence

1155 frames over 121.686 wall seconds / 102.963 game seconds. Aggregate within-bout cadence is 9.488 FPS, median interval 100.6 ms, p95 182.8 ms, maximum 451.4 ms. This is a cloud software-rendering observation, not phone performance.

Ten fully sampled windup → active → recover → idle cycles: four left sweeps, two right sweeps, four slams. Left cycles are 1.479–1.578 game seconds; right 1.494–1.563; slam 2.038–2.805. Four additional observed cycles are incomplete/interrupted: three sword-bout windup-to-idle transitions and a player-defeat slam with no sampled recovery. Raw cycle timings and events are retained in `summary.json`; no frames are synthesized.

## Exact world geometry: still rejected

The native source hash is `32c4f9b55c5303e75877c8abae7765947a3814c39bb15d3c7a0046e61cb93641`.
All 22 bone translations, quaternions and scales and the actual mesh-world matrix are retained per frame. Analysis sums the exact four skin influences using the posed hierarchy and inverse bind translations, including the actual ragdoll root transform. Ground plane is Y=900.

- Living minimum: +0.027000001 m.
- Dead minimum: −0.201038894 m.
- 100 frames have vertices below the −5 mm threshold.

The corpse defect is essentially unchanged from build1. Lifecycle repair is not a contact repair. Collider, visual, animation and final gameplay quality remain unaccepted.

## Evidence and reproducibility

`closure.json` pins evidence, observer/measurement sources and the unchanged product source. `host-files.json` pins every built host file; `product-files.json` pins every original product/pack/receipt file; `source-files.json` is a repository-relative source snapshot. Reports/traces preserve exact numeric values with compact JSON formatting. Five labeled portrait captures are included. The full video remains in the original local capture folder; its byte length and complete SHA-256 are recorded, but it is not published by this verification.

The first browser attempt stopped before creating a page because the default ffmpeg cache was missing. Retrying with the project's existing Playwright cache succeeded; no download or install was needed. Build and browser lane processes are finished and the browser is closed.
