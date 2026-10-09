# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (the plain loader, the night on the tape; sf72-pine14)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/run.mjs`, the vitest proofs) is still
the old fail-closed compatibility probe (it imports the page's `runtime/index.ts`, whose renderer modules keep their
parameter properties); the tape that will become it now walks the day and the night up to the Antler King's fight.

## Landed

- Bake inputs (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `runtime/fauna.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`. Map inputs
  (`scripts/map-hash.mjs`): `shard.config.ts`, `layout.ts`, `world/`, `generators/`, `models/`. Run both bakes from a clean
  export of the candidate (`scripts/serve-build.sh --rev <candidate>`, then
  `scripts/browser-lane.sh node scripts/bake-pine-physics.mjs --url=<preview> --revision=<candidate>`).
  `quest/`, `runtime/quest.ts`, `runtime/headless.ts` and `runtime/weapons/` are neither.
- Earlier lanes: herds, roster, elites, live spawns, the roar, the King on `installBossRow` with his record on the flags, the
  day clock, the three weapons and the swap, the Warden's Hollow headless and the entry proof, the clear entry canyons, one
  ledger key (`950eecdf9`), one zipline law (`609b3beef`), the day's tape (`357e7b538`).
- **sf72-pine14:**
  - step 1 — Pine's headless closure loads under `scripts/sim-node-loader.mjs` alone: the constructor parameter properties
    of `src/game/eliteSystem.ts` (EliteCore), `combat/eliteScripts.ts`, `runtime/king.ts` and `runtime/questClock.ts` are
    plain fields (no behaviour change: the day tape's hash is identical, 52796a23…; physics rebaked, only its inputs hash
    moved; full clean-export suite 1051 files / 5817 tests green; Nalati's elite tests pass).
  - step 2 — the night on the tape and `pine.aim`:
    - `pine.aim` (a `script` command, `runtime/weapons/headlessRanged.ts` `AIM_COMMAND`): its value is the share along the
      target's body capsule the tick's shots aim at (0 rear … 1 front; none: the middle, in the old arithmetic, so every
      existing tape flies exactly as before). The page aims along the camera; this is the tape's way to aim at a point.
    - the tape (`witness.ts`, `tape.mjs`, plain loader): the lever-action off its pegs on the first porch visit; the day's
      legs; any creature hunting the player within 18 m (stalk / charge) is shot at with the crossbow until none does (the den's
      three bears follow the player from the den lantern; on the porch they pinned the capsule in the cabin's corner);
      a held-up `go` leg steps round what blocks it; back to Hale, one press (`wait:night`), the clock's run to night;
      off the porch and down the west road bend to bend after the Ghost Stag (`followed:stag` at tick 25,853); into the
      stones; the King's fight by weapon play: a band 10–15 m round him circling, a jump over each root ring as it
      reaches the player, the lever-action at his ribcage (`pine.aim` 0.75) only while it is open, the crossbow once the
      lever is spent. `tapeProof` stops after 1,800 fight ticks: `at-king`, 27,790 ticks, the player standing, the King 1409 / 1500.

## Blocker: the King's ribcage is unreachable headless

`runtime/king.ts` `onRibs` is a ball of radius 0.36 × scale × 1.15 (1.08 m at his 2.6) on his body capsule's axis, 0.75
along it; his body capsule's radius is 0.56 × 2.6 = 1.46 m, and `bodyHit` returns the capsule's surface point, so no shot
can ever land within the ball: every headless hit is bark (×0.25, 13 a lever round, 9 a bolt). With 28 lever rounds and 30
bolts that is ~630 of his 1,500, and the longbow is his own reward, so **the headless King cannot be felled by weapons**. The
page hits his second body capsule (`dims.fore`, the chest bone, `physics/creatures.ts`) and tests the hit point against the
rig's ribcage (`models/antlerKing.ts` `ribcageWorld`). Fix: bake the chest bone's rest offset (and the cage's) into the
King's body row, give `bodyHit` the fore capsule (as `AnimalManager` does with `foreCapsule`), and test `onRibs` against
the baked cage point; then rerun `tapeProof` (the fight already fires only into the open ribcage).

## For the Codex lane (non-graphical; no browser needed except a physics rebake)

- Run the tape: `node --import ./scripts/sim-node-loader.mjs test/proof/pine-hollow/tape.mjs` (~12 s CPU; prints
  `status`, the King's hp and the canonical hash; today `at-king`, 27,790 ticks, hash a1dbdd28…).
- The rib fix touches `runtime/king.ts` (`onRibs`), `runtime/weapons/headlessRanged.ts` (`bodyHit`) and the bake's King row:
  `scripts/bake-pine-physics.mjs` must capture the chest bone's and the cage's offsets from the page's rig (a browser bake:
  `scripts/serve-build.sh --rev <candidate>` from a scratch dir, then `scripts/browser-lane.sh node scripts/bake-pine-physics.mjs
  --url=<preview> --revision=<candidate>`), and `test/shards/pine-hollow/physics-bake.test.ts` / `headless-runtime.test.ts`
  ("takes the King's bark at ×0.25 and his ribcage at ×0.6 shut") must keep passing. Once a lever round into the open
  ribcage lands ×3 (~162), raise `KING_PROBE` / let `tapeProof` run the leg to `dead:king` and the dawn wait.
- Then the checkpoints: copy Sky's pattern (`test/proof/far-reach/run.mjs` modes `checkpoints` / `fresh` / `slice-*`,
  `witness.ts` `writeCheckpoints` / `checkpointsFresh`, `checkpoints.test.ts`); `TapeState` is already resumable
  (`leg, waypoint, ticks, best, stall`). Each vitest slice ≤ 10k ticks, `--coverage` time < 1/3 of its timeout.

## Next (Pine headless), in order

1. The rib hitbox above; then the King felled by the tape, the dawn (`seen:dawn`, the quest's fact), `tapeProof` → `walked`.
2. The canonical witness: `run.mjs` (headless / replay from a King mid-fight checkpoint / ledger from gameplay through
   `FactIngress`, as Sky's `witness.ts`), committed checkpoints + inputs-hash freshness (Sky's `c162fbd6a`: the tape is
   ~28k ticks, so slices from checkpoints at the porch, the den and the stones), `canonicalSimDigest` (already the tape's
   hash), compatibility.json from a real run, and the vitest proofs replace the fail-closed ones.
3. Honest open items for the witness's list: the King's rib hitbox (above); arrow wind (headless arrows fly in still air);
   the page's walk-over recovery of stuck arrows; the moving spread (headless shoots standing); the dialogue box's reading
   time and the prompts' line of sight / nearest pick (a command names its prompt); the resin / token / secret / miller /
   thrall / journal / kill feats are not emitted headless (only the lanterns, zipline, quest and the King's); the night
   thralls, the millrace errand and the lodge are not hosted; the re-fight's amber resin has no item effect; rain wander
   goals are null headless; the page's King record still lives in `pine.bosses` state; the night is short (the clock's 4
   minutes from 18 h): the fight must end before the dawn sends him away.
4. The grid admission (`grid-ready`) installs the same world with the standalone edge walls; the grid's world has none.

Plan-State: unchanged.
