# E357 Explore viewmodel fix — sol-vm

Explore reuses the game camera. EquipmentService hides each weapon model, but a custom weapon can show itself again during update (WarFan does). Explore now hides the engine-owned ViewmodelRoot on first entry, covering kit/custom models and late mounts in every mode. It restores the root’s previous visibility when leaving. No shard content changes.

Runtime candidate: `09147d7c8121b77d6c8724f982b07db7714a3b2e`, based on `930e5517cce43ceb272b188a3965e5ebb7bc942b`.

- `far-reach-world.jpg`: World Explore after flying upward, fan child visible but shared root hidden; no weapon draws.
- `driftwood-isle-world.jpg`: World Explore above the cove; no weapon draws.
- Both JPEGs reviewed at 390×844. Chromium with iPhone user-agent/touch emulation and Metal GPU, not a physical iPhone or Safari. The USB iPhone was unavailable.
- Browser exit-to-title and resume-play checks restore the shared root and active weapon on both shards.
- Focused lifecycle tests cover hub/world/model/sets, repeated opens, custom visibility overwrite, late mounts, exit/re-entry and a pre-hidden root.
- Clean-export tsc and whole-tree oxlint pass; 360 suites / 2459 tests pass.
- Original four phone fingerprint + poses green; all seven boot.errors empty. All-shard command exits 1 only for `_template` poses (empty baseline versus missing row); the two new shards are lane-pending. No baseline was edited.

Reproduce parity: `node scripts/parity.mjs --export=09147d7c8121b77d6c8724f982b07db7714a3b2e --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses --out=/private/tmp/sol-vm.fHJdMi/parity-candidate`. Raw output remains in that scratchpad. Browser and build preview closed.
