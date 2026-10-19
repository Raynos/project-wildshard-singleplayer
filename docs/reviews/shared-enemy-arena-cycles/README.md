# Shared arena complete functional cycles

49/49 checks passed in the same shared runtime, with zero page errors. The exact
build3 artifact was tested; build4 differs only in its build-receipt timestamp,
with all 282 runtime/data/asset files byte-identical (separate equivalence proof).

For each of Mantis, Conch, Colossus and Puffer the probe:

1. Started a fresh enemy in the retained single Game/canvas/world.
2. Killed it using actual touch sword inputs and recorded diagnostic player placement.
3. Collected the exact authored local coins: 3, 3, 35 and 2 respectively.
4. Observed no post-death player damage, then retried with full enemy/player health
   and an empty local reward receipt.
5. Allowed real enemy attacks to defeat the player, verified a defeated player
   could not damage the enemy, then retried to a fresh healthy bout.
6. Verified the world save documents, shard state and generation stayed empty and
   unchanged after both reward collection and defeat/Retry.

Back, re-entry, reload, empty persistent stores, Bellback unavailable and the same
retained engine instance also passed. No enemy HP, AI, strike state, actor memory,
clock or damage values were injected. No engine or runtime-source defect was found.

## Evidence

- `report.json`: complete sampled state, placements, phase transitions and outcomes.
- `*-frames.json`: each actual browser animation-frame timestamp, simulation time,
  enemy/player health and diagnostic phase. These are observations, not clock writes.
- Four labelled phase captures per enemy: kill, collected loot, player defeat and
  final Retry.
- `manifest.json`: source/build references, evidence hashes, measured display
  cadence, and the complete continuous recording's SHA256 and encoding metadata.
- `scripts/shared-arena/qa-cycles.mjs`: standalone controller; fresh output required,
  immutable completed report, existing muted portrait cloud-browser lane.

The full recording is retained in the cloud QA output: 416.08 seconds, 402×874,
VP8 WebM, 45,923,620 bytes. It is not embedded in the repository or public Site.
Its 25fps container repeats frames; actual cloud display rate was approximately
4–5.5fps and is documented in the frame logs. This is functional integration proof,
not animation-quality acceptance, a long soak or physical-iPhone performance proof.
All prior enemy art/animation acceptance work remains open.

The browser-lane wrapper attempted to re-enter after completion. The fresh-output
check refused before another browser could start; immutable evidence was preserved
and the owned wrapper closed. No existing Site or exact fallback host was changed.
