# Handoff (sf72-driftwood, part 10) — 2026-10-09, SF72 Driftwood Isle headless

Coordinator `wildshard-new` pushes. Supersedes part 9's "Not done". Driftwood's canonical witness
(`test/proof/driftwood-isle/`) is UNCHANGED and still fails closed (its entry is still `runtime/hybrid.ts`).

## Landed (part 10)

- **ba9d61dd9, restores judged on restored world state (shared rule):** Rapier's snapshot bytes are not canonical
  (`takeSnapshot(restoreSnapshot(x)) != x` by 4–13 bytes, two 13-byte records swapped near offset 194 k of Driftwood's
  3.3 MB; repeated round trips keep permuting, no step between, every body / collider / contact equal). HEAD's quest
  test passed by luck. `test/fake/simState.ts` (`physicsState`, `physicsDifference`, `canonicalSimDigest`);
  `expectSameSimSnapshot` restores both worlds and compares state when the bytes differ (strict: a 1-ULP pose fails,
  `test/engine/sim-snapshot-state.test.ts`). Signal / Sky / Nine / the template's witnesses hash canonical state and
  check restores and the worker continuation on it; compat hashes re-recorded from two identical native runs each.
- **348c0a1d7, the barrel push is closed loop:** each move reads the barrel's pose (its length axis from the body's
  rotation) and pushes it at plate b along one of its own axes, slowly near the end, judged by where it got to; the walks
  to plate a and the cave go round a 1.9 m ring about plate b. Stick-noise sweep (1e-9…1e-3 per tick): push 36/36,
  whole quest test 26/28 (HEAD: ~50 %). arm64 + x64 Node (Rosetta, ci-green's `run-arch.sh`) green.

## Not done (in order)

1. **The two remaining noise failures** (seeds 19 / 21 × 7919 at 1e-6, a scratch copy of the test with noise on `steer`):
   the barrel ends against the 1.9 m block's east corner (143.5, 7.4), where the spot behind it is inside the block, or
   rolls north west past the 1.7 m block (141.6, 13.3). Fix: when the spot behind is blocked, push it out along the
   free axis first (or aim the first move at a staging point east of plate b, (146.5, 6.5), then north / west).
2. **Browser barrel push check** (owed since part 9): a muted iPhone 16 Pro run pushing the barrel onto plate b.
3. The swords on the new inputs (a0aa16128): dodge wake on `player.dodge`, heavy from the held `heavy`, lunge via
   `host.dashTo` + `sweptLunge`.
4. Night respawns (the sailor's night gate on `host.dayClock.night`).
5. The entry proof: send the coordinator the lane widths and a proposal before any world-data change.
6. A freshness check for `runtime/spots.baked.json`.
7. The witness on `runtime/headless.ts` (committed checkpoints + freshness if long).

## Map notes (tide puzzle, physics rays)

Plate b (144.9, 9.9, slab ±0.55); the 1.7 m block x 140.25–143.6, z ≥ 9.4 (its east face stops a westward push on the
plate); the 1.9 m block x 139.5–143.1, z 4.5–8.25; rock east of x ≈ 147.25–148.75 for z 3–10; the barrel's home
(147.5, 3.5). Driftwood's world has one dynamic body (the barrel), so it alone decides whether snapshot bytes permute.

Plan-State: unchanged.
