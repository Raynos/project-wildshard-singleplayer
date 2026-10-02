# E357 — flyer lock-on (sol-lock)

Phone-tier Chrome / Metal at **390 × 844**, captured from a clean private runtime candidate. These are iPhone-sized browser captures, not a physical-device performance reading.

- `drift-ray-locked.jpg`: LOCK pressed on the real drift ray from the rope bridge (feet ≈ 1,31,-24), ~21 m horizontally / ~23 m to its body edge in 3-D; outside the ground 12 m acquire range.
- `drift-ray-high-locked.jpg`: LOCK pressed on a roost ray from the island (66,30,-4); pitch ≈ 56°, above the ground clamp. Three authored rays overlap here.
- `dune-ray-locked.jpg`: LOCK pressed on the real dune ray from the sand, ~16 m horizontally / ~21 m to its body edge in 3-D; outside the ground acquire range.
- `proof.json`: poses, equipment, observed lock state, clean boot errors and the 300-frame live dune-ray dive. Its altitude spans 21.39 → 3.00 m, all frames stay locked, max yaw/pitch step 3° at 30 Hz (default Gentle). The projected reticle is visible in 272/300 frames; it hides while the target passes behind the camera rather than snapping the view.

## Reproduce

Build/serve the private candidate with `scripts/serve-build.sh --rev SHA --hours 1 --name lock-flyers`.
Run `scripts/browser-lane.sh --max 4 node progress/normalization/lock-flyers/capture.mjs --url=BUILD_URL`; it closes its browser in `finally`.

The runner serializes the existing parity and settings init callbacks into the agent-browser init script. Existing harness params only. Frozen authored creatures make the LOCK press reproducible; no authored positions/species content changes. Set only the selected dune ray's `harnessHold=false` and advance 300 frames for the live AI observation.

## Verification

Clean export: TypeScript and whole-tree oxlint pass; full Vitest **360 files / 2,469 tests pass**. The flying fixture covers unknown species kinds, high cone, true vertical acquire/release distance, species range override, elevated Rapier cover/LOS grace, invalid tuning, overhead bearing, capped dive tracking and live projected reticle. Ground range/kind/pitch behavior stays covered; existing lock/flight tests pass.

Phone fingerprint/poses: all seven shards boot with **zero errors**; the four original shards compare **green**. Overall comparison remains red for the template's missing pose baseline and Signal Dunes' GL ceiling +0.029758 MB; Far Reach is lane-pending. No baseline or shard content edits. Captures inspected; all JPEGs under 500 KB.

Choice: `flight.lockRange` is an absolute optional range, default **24 m**, release **1.5×**; every G2 flight body is eligible regardless of its kind. Flyer player-motion feed-forward is capped with the target tracking to prevent snaps; ground feed-forward remains unchanged. No UI layout or reticle-source changes were needed.
