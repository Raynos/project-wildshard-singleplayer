# S1.4 — Fei Zhua Tool and grapple input proof

Source: `77bc2ce0` (Tool/context/HUD/playground), `2449eec7` (early ownership release),
`fd9da1bb6da4221992ebf595da7373bdb384c7a4` (deterministic buffered input).
Before: `7401d8052b40906fb2ab33c7a7bedd797a95b06f`. Metal, m5, 390 × 844 phone, capture clock 30 Hz.
The final proof commit also fixes the new nested test's WASM loader for clean exports.

## Direct replay

[s14-parity.json](s14-parity.json) records the direct comparison. The B27 baselines were stale during these runs;
their red verdict is not treated as the behavior verdict.

- All four shards boot with zero runtime errors. All 12 pose positions and draw-call counts are exact.
- All four walk results are exact except measured wall-clock seconds. Combat and pause/resume results are exact.
- All four unloaded scopes have every census field at zero. GPU totals equal the retained engine totals.
- Playground: START → P1 → P2 → BASE → L1 → L2 → FINISH, every sampled position and LOCK/JUMP label exact
  across 660 frames. First frame standing on each pad after FIRE: **62, 67, 79, 63, 60, 51**.
- City: the Well crossing and stair terrace have exact positions and labels across another 360 frames.
  Their final feet are respectively `[-9.567956872, 119.138985154, -20.598142173]` and
  `[25.993761707, 127.469948740, 5.083576558]`.
- Nine Dragon's three pose images and both city landing images: SSIM **1.0**. Playground images: **0.998156–1.0**.
  Driftwood poses: **0.995747–0.999957**; Nalati: **1.0**.

Pine's concurrently migrated scene differs from the earlier SHA: about 131–137k more pose triangles, with exact
positions/calls and SSIM 0.965029–0.984785. S2.1/S2.2/S2.4 were notified; this difference remains their/lead's
before/after audit, not a silent S1.4 baseline acceptance. S2.3's two persistent engine aggression answerers also
change the post-unload event count from 3 to 5; scoped resources still return to zero.

## Validation and remaining whole-tree work

Focused suite: **38/38** tests, including an actual Rapier capsule at 22 m/s, buffered consume ordering, repeated
context ownership release, practice fallback, miss shot, HUD pin/relabel restoration, Bag metadata and playgrounds.
Whole working typecheck and owned lint passed before the proof commit. Clean export `fd9da1bb` passes CSS,
generation, app/API typecheck and whole oxlint; Vite builds successfully for its browser runs.

The combined Vercel gate stops at sibling S2.1/S2.4 boundary-ratchet rises. A separate clean exported full Vitest run
found the new nested Fei Zhua WASM-inline fs denial (fixed here), Pine's pre-existing undefined-variant mapping
fixture, and S2.2's `longbowView.ts` model-contract rule (owners notified). The lead must rerun the clean whole
gate after those checkpoints. No push, deployment or pin movement by this builder.

`onTryToggle`, `onJumpRequest`, `traversalStep` and `touchHint` no longer occur in `src/`. Outside the shard,
the Nine Dragon slug occurs only in generated data. The historic `ws.nineBoot` legacy save migration key remains.
No gameplay constants or course geometry changed. Per the lead, no-hook/no-enemy LOCK still arms a miss shot;
enemy targeting and practice continue to fall through.

## Reproduction

Raw runs and deterministic replay helpers remain in `/private/tmp/e357-s14/`:
`before`, `final-poses`, `before-motion`, `final-motion`, `grapple-before-live`, `grapple-final`,
`fragment-before-live`, `fragment-after-final`, and `image-comparison.json`.

```sh
scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=fd9da1bb6da4221992ebf595da7373bdb384c7a4 --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses --retry=0 --out=/private/tmp/e357-s14/replay-poses
scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=fd9da1bb6da4221992ebf595da7373bdb384c7a4 --lane=m5 --shards=all --tiers=phone --only=walk+combat+leak --retry=0 --out=/private/tmp/e357-s14/replay-motion
scripts/browser-lane.sh --max 10 node /private/tmp/e357-s14/grapple-smoke.mjs fd9da1bb6da4221992ebf595da7373bdb384c7a4 /private/tmp/e357-s14/replay-grapple
scripts/browser-lane.sh --max 10 node /private/tmp/e357-s14/fragment-smoke.mjs fd9da1bb6da4221992ebf595da7373bdb384c7a4 /private/tmp/e357-s14/replay-fragment
```

Screenshots inspected: [FINISH](s14-playground-finish.jpg), [Well landing](s14-well-crossing.jpg),
[stair terrace](s14-stair-terrace.jpg). Every owned browser and preview is closed.
