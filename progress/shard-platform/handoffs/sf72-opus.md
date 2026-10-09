# Handoff (sf72-opus) — 2026-10-08, SF72 Signal Dunes headless, second 90-min lane (sf72-signal)

Coordinator `wildshard-new` pushes. Landed locally with pathspec commits; no browser, preview or Simulator left running.
Signal's canonical witness (`test/proof/sunscar-dunes/`) is UNCHANGED and still fails closed: the runtime owns the
terrain, colliders, 13 homes, the whip and the quest's first five steps, but not yet the Matriarch, the ledger facts
from play or an entry proof. Sky Reach belongs to the parallel lane sf72-sky.

## Landed

- `17c188c89` / `c6858f253` / `8b4ac8ca9` (first lane): interactions behind a renderer-free port, the native bake,
  `runtime/headless.ts` with the 13 homes (see git log for detail).
- `e1c387f42` `scripts/shard-platform.mjs` milestone flags read `test/proof/<slug>/compatibility.json` (status
  `passed`, ledger `gameplayEmissionProven`, `compatible` + exit 0) over the bare test files; `transitional` holds until
  the trusted runtime is gone AND the witnesses pass. All six native shards now read false, as their witnesses do.
- `a4042f136` step 1, the whip: `runtime/whip.ts` installs the admitted `weapon.sunscar-whip` row as an engine
  `ItemRuntime`; a `player` command's attack queues its light crack (18) from the eye (1.68 m) at the target's body,
  7 m reach, 0.9 m lane, 0.45 s cooldown; exact snapshot adapter `item.weapon.sunscar-whip`. The protocol's attack has
  no heavy flag, so headless heavy cracks (16) are only reachable through `WhipCommand.heavy`. The browser family's
  0.12 s unroll, second lash, pull and stagger are not modelled. Graph sunscar→engine +2 approved.
- `3263244d4` step 2, quest + interactions: `runtime/quest.ts` = `DeclaredQuests(host, shard.quests, { fact, coins })`
  (effects through `context.emit`) + `SignalInteractions` on `host.flags`, driven by `script` commands on
  `sunscar.interact` with `SIGNAL_ACT` values (talk 0, logbook 1, well 2, pour 3..5, fire 6, crank 100 = the heavy
  double crack, light 101..103) at the browser radii from the eye. Spots are baked (`physics.baked.json` `spots`, from
  the built world; the bake rerun on clean a4042f136 matched actors / pieces / bosses byte-for-byte). Sefa's head is
  SCOUT_AT + ground + 1.62 (quest/scout.ts), radius 3.5. Not modelled: prompt line of sight, and crack commands do not
  spend the whip's cooldown. Graph sunscar→game +2, →engine +1 approved.

## Exact next steps (in order)

1. **Matriarch**: split `combat/matriarch.ts`'s `BossScript` (hp/phase/storm goal/invulnerable/checkpoint/reward) from
   its views (BossBar, fog, shells, CoinBurst, toasts); summon from `installSignalQuest`'s `lit` port (the browser's
   `fire.onLight`, then the player entering her basin); spawn `sunscar.matriarch` with the baked spec via `host.spawn`
   (her six draws from the homes' stream `Rng(5363 + 31)`, after the homes'), `MatriarchBrain`
   (`runtime/species/matriarch.ts`) at the 10 Hz cadence, `BossBrain` continuation in an adapter; victory →
   `MATRIARCH_FLAG` (completes the quest: fact `sunscar.signal` + 5 coins already flow through DeclaredQuests) and fact
   `sunscar.matriarch` via `context.emit`. Any knockback on the player uses sf72-sky's `host.impulsePlayer` seam
   (`defff10d1`, `src/engine/player/impulse.ts`); never build a second one. `combat/matriarch.ts` is a bake input
   (`signal-physics-inputs.mjs`) — rerun the bake (`scripts/browser-lane.sh node scripts/bake-signal-physics.mjs
   --url=<clean build> --revision=<sha>`) in the same commit.
2. **Entry proof**: `proveEntries` walking the shardfile's declared entryways on the native terrain (lanes ≥ 1, steps ≥ 1).
3. **Witness**: point `test/proof/sunscar-dunes/run.mjs` at `runtime/headless.ts` through `HeadlessSimulation` +
   `trustedRuntime`; headless 10k, replay (Matriarch mid-fight checkpoint + suffix, exact hash), ledger (both facts from
   gameplay, durable, deduped); update compatibility.json / README only from the real run. `shard-platform --json`
   then reads true by itself. Check: a restore after quest completion must not re-emit (the adapter throws on effects
   during install).

## Proof receipts (this lane)

- Clean-export full Vitest on HEAD + the quest slice: 994/995 files, 5544/5545 tests; the one failure was AG7's
  graph count, green (111/111) after the export-only regeneration. Strict tsc (root + layers + scripts), oxlint,
  ratchet, shard-coupling green.
- Browser (clean a4042f136 build, muted Chromium): boot smoke standalone ×2 + grid PASS, 0 faults;
  `physics-baseline --mode=walk --shard=sunscar-dunes` 7 legs, 0 stuck. The quest slice touches no browser module.
- `shard-platform --json` Signal: public 42 / custom 4031 → 4141, runtime 686 → 796, share 0.0103 → 0.0100.

Plan-State: unchanged.
