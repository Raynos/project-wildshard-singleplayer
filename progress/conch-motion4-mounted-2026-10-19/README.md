# Conch motion4 local mounted proof

Scope: unchanged existing review-Site HTML served locally, with only `/conch-engine/` routed to the frozen Conch motion4 build2. This is **local mounted proof, not a public deployment**. The published Site and its four actual application directories remain untouched. Existing Site text still describes motion3 because the Site source is intentionally unchanged.

Harness: `scripts/qa-conch-motion4-mounted.mjs`, derived from the prior mounted-native QA. The exact 137-file build is checked against `docs/reviews/conch-motion4-capture/build-manifest.json` before and after every browser run. All four existing application mount inventories and Site HTML SHA-256 are also compared before and after.

Desktop testing follows the actual Site Play link into its popup and clicks Start. Phone-policy testing uses iPhone 16 Pro cloud Chromium emulation, native DPR3 and the unchanged engine's 2× pixel-ratio policy, with normal touch Start, Attack and Retry. Diagnostic player placement and aim are explicitly logged. No enemy state, health, clocks, RNG, damage, rendering, render-time camera substitution or actor model overrides; no observer recording harness. A passive animation-frame sampler reads guard and counter state without wrapping engine callbacks. The normal native camera/viewmodel remain visible.

Tests cover single native actor, sword damage, guard/counter observation, native enemy defeat and three local coins, player defeat and blocked attack, fresh Retry, reload/reentry, relative asset paths, and empty unchanged browser/global/shard stores. Corpse samples cannot exclude inter-sample damage combined with regeneration. Sword-only supplied loadout; spear is unavailable and never injected.

No physical-phone, Safari, performance, human-fun or every-frame visual acceptance claim. Independent motion review is separate. Browser and static server belong to one process and close in its `finally` block. Failed runs remain preserved under separate run directories.

## Result

Run1 passed all 34 checks (09:11–09:15 UTC), exited0, and closed the browser/server. Phone policy was DPR3 with engine pixel ratio2 and804×1748 canvas.137 app files matched the frozen manifest before and after. The existing four mounts and Site HTML were byte-identical. No failed mounted browser run occurred.

Counter state was observed, but counter-specific HP loss was **not established**; do not interpret the overall pass as counter-damage proof. Regular thrust damage, enemy/player defeat, sword damage and reward were observed. See `summary.json` for coverage limits and raw `run1/report.json` for all samples. Root source-checkpoint hooks briefly shared the cloud host from approximately09:12 UTC; no performance claim is made. Entry, desktop, corpse, defeat and reentry screenshots were inspected. Close corpse/defeat views reflect diagnostic player placement, not camera-quality acceptance.
