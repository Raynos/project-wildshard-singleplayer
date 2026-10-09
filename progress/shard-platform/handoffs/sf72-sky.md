# Handoff (sf72-sky) — 2026-10-09, SF72 Sky Reach headless, part 7 (sf72-sky7)

Coordinator `wildshard-new` pushes. **Sky's canonical witness passes** (`test/proof/far-reach/compatibility.json`,
compatible: true, from a real `run.mjs all`, two identical native runs). The lane's SF72 work is done; what follows is
for the plan row and whoever touches Sky's headless code next.

## Landed (part 7)

- `f395e123c` the board updraft fix (engine `player/board.ts`): a same-tick touchdown (the board began the step at the
  ride height) spends its fall; ordinary landings keep their dip (board-tape oracle byte-identical). Receipts:
  `progress/shard-platform/sf72-sky-updraft/`.
- The next commit: the witness. `run.mjs all` plays one tape of tick commands from the spawn to the Storm Roc's fall
  (21,134 ticks, victory 21,014): keeper, three vanes GUSTed, the roost felled, both hover bridges and the updraft on the
  board, the winch (quest fact 7,928), the raised bridge, the Roc by War Fan play; replay from the gale-wall checkpoint
  (10,140) byte-exact in process and in the shipping worker; both facts into the durable Ledger once.
- CI runs the tape in slices (DEPLOY.md: ≤ 10k ticks a test): `slice-step` (spawn → 10,000 ticks, past the step and
  the winch), `slice-replay` (step → gale wall + its replay), `slice-storm` (gale wall → storm phase), `slice-ledger`
  (the winch window from the step, the fall from the storm). They resume from `test/proof/far-reach/checkpoints/`
  (step / gale / storm, ~88 KB gzipped wires, byte-deterministic) and assert outcomes only.

## When a checkpoint test fails

`checkpoints.test.ts` refuses checkpoints written from other headless inputs: the hash covers every repo module the
witness loads (Sky's runtime, the engine's sim / physics / player, the tape), the Rapier wasm and Sky's assets. Any
change there (an engine sim commit too) needs:

    node --import ./scripts/sim-node-loader.mjs test/proof/far-reach/run.mjs checkpoints

(~12 s), committed with the change; then `run.mjs all` and refresh `compatibility.json` if its numbers moved.

## Open notes (not blockers)

- The updraft's lift is cosmetic headless and in the browser: its 0.2 m/s-a-tick feed sits under `IMPULSE_REST_SQ`, so
  `decayImpulse` zeroes it every tick; the ramp collider carries the board up (sf72-sky6's finding). A taste call.
- The Roc's gale-wall phase takes the tape 7,200 ticks (phase 0: 1,220, phase 2: 3,700): fan play at its height is slow.
- Public SDK share: far-reach 1.4 % (93 public / 6,644 custom lines), runtime + trusted 1,245 / 1,377 ceiling.

Plan-State: unchanged.
