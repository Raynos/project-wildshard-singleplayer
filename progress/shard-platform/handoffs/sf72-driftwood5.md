# Handoff (sf72-driftwood, part 11) — 2026-10-09, SF72 Driftwood Isle headless

Coordinator `wildshard-new` pushes. Supersedes part 10's "Not done". Driftwood's canonical witness
(`test/proof/driftwood-isle/`) is UNCHANGED and still fails closed (its entry is still `runtime/hybrid.ts`).

## Landed (part 11)

- **74032f176, the last noise failures:** the cove's reef crabs scuttled into the barrel resting on plate b and shoved
  it off during the walk round (two crab capsules in contact at the kick); the push now clears crabs within 20 m of
  plate b first. A barrel wedged across the lane between the two blocks (two moves without progress) is walked into
  until the never-jam rule sends it home, then the push starts again. Sweep (stick noise 1e-9…1e-3 + 0, a scratch copy
  of the test with seeded noise in `steer`): 112/112 arm64, 70/70 x64 Node (Rosetta).
- **3d20b4446, raw snapshot compares:** 38 restore comparisons in 31 engine / game / grid / shardfile tests moved onto
  `expectSameSimSnapshot`. Still raw, in other lanes' files: `test/shards/far-reach/headless-quest.test.ts:124/127`;
  `test/shards/sunscar-dunes/headless-quest.test.ts:106/113`, `headless-runtime.test.ts:102/107/135`,
  `policy-continuation.test.ts:56/61`.
- **9fb1523d6, the page's barrel push:** 3/3 muted iPhone 16 Pro runs press plate b with the touch stick, no page
  errors (`progress/shard-platform/sf72-driftwood11/`, script re-runnable).
- **7b57874bd, spots freshness:** `spots.baked.json` carries `inputs` (scripts/driftwood-spots-inputs.mjs, 63 files);
  the quest test refuses a stale bake. Rebaked from a 357e7b538 build: identical except the barrel, which is now its
  home (147.5, 0.37333, 3.5), not its settled pose (1e-5 jitter). Sweep re-run on it: 84/84 arm64, 56/56 x64.

## Not done (in order)

1. **The entry proof: the coordinator picked (c), the flared sea ramps. Build it first.** Every 8 m socket is dry for
   16.5 m (15 m asphalt + 1.5 m landing), then narrows to the pier (4 m, manifest `PIER.width`) or a jetty (3 m,
   `world/build.ts`). The 9 m ramp (`SEA_RAMP_RUN`, `world/Pier.ts`) becomes a trapezoid, 8 m wide at the landing and
   the deck's width at the top. Requirements:
   - the flared ramp is the default (a functional fix: the road's outer lanes no longer walk into the sea);
   - the old straight ramp stays selectable as ONE Debug row (`ctx.debugRow`, e.g. "Driftwood pier ramps: flared /
     straight"), never a URL switch;
   - the rails follow the flare and the colliders match the visuals;
   - a Driftwood map + physics rebake from a clean export (then `node scripts/bake-driftwood-navmesh.mjs` if the navmesh
     moves; the spots `inputs` cover `world/`, so rebake the spots too);
   - the entry proof walks all lanes, the walk baseline is 0 stuck, boot smoke passes (grid included), and parity changes
     only at the four ramps;
   - before / after images of each ramp from the road, iPhone portrait, ≤ 500 KB JPEG, in
     `art/driftwood/round-<n>-pier-ramps/`. The coordinator adds Jake's pick to the plan.
2. **Night respawns:** port `quest/Ecology.ts`'s RespawnQueue to headless. That means the delays from the `spawn`
   stream, the 60 m out-of-sight rule, the sailor at night on `host.dayClock.night` in his hold, and a fresh spawn near
   the herd home on land, with the herd membership restored. The queue goes into the keeper's continuation, and
   `keeper.ts`'s practice crab return is the pattern.
3. The swords on the new inputs (a0aa16128): the dodge wake on `player.dodge`, the heavy swing from the held `heavy`,
   the lunge via `host.dashTo` + `sweptLunge`.
4. The witness on `runtime/headless.ts`, with committed checkpoints and a freshness check if the tape is long.

## Map notes (tide puzzle)

Plate b (144.9, 9.9, slab ±0.55). The 1.7 m block covers x 140.25–143.6, z ≥ 9.4, and the 1.9 m block x 139.5–143.1,
z 4.5–8.25; the lane between them (z 8.25–9.4) can wedge a barrel lying north–south. Rock lies east of
x ≈ 147.25–148.75 for z 3–10. The barrel's home is (147.5, 3.5). Three reef crabs live within 20 m of plate b.

Plan-State: unchanged.
