# Handoff (sf72-sky) — 2026-10-09, SF72 Sky Reach headless, part 6 (sf72-sky6, 90-min cap)

Coordinator `wildshard-new` pushes. Sky's canonical witness (`test/proof/far-reach/`) is still UNCHANGED and fails
closed. Part 6 landed the board seam's Sky half; the spawn-to-crown tape is drafted and plays the whole quest up to the
updraft, where it finds a board-law bug (below) that blocks the step on the shared law, so it is not landed.

## Landed (part 6)

- This commit (see git log): **Sky's board pieces and updraft in the played host.**
  - `physics.baked.json` rebaked from the clean candidate (muted Chromium, iPhone 16 Pro): 13 actors and 43 pieces
    byte-identical except `mode: 'board'` on `far.hover.roost`, `far.hover.keeper`, `far.updraft` (and the input hash of
    runtime/index.ts).
  - `runtime/headless.ts`: `BakedPiece.mode`; the board pieces are added and registered with `host.boardColliders` on a
    fresh install (and on the entry proof's fresh hosts), never on a restore; the War Fan is stowed on the board (the
    browser's `fan.stowed = board`); the updraft's lift is an onStep (`far.updraft`) feeding `UPDRAFT_LIFT * dt` through
    `impulsePlayer` while riding inside the column.
  - `runtime/updraft.ts`: the column rule and `UPDRAFT_LIFT`, now shared by the browser's `far.updraft` system and the
    headless host (index.ts uses it; same arithmetic).
  - `runtime/stormRocBrain.ts`: its parameter property became a field (Node's strip-only TypeScript refuses parameter
    properties, so the plain-Node witness could not import the Roc).

## The updraft finding (needs a ruling before the tape can land)

On the board the updraft never lets the board land properly: every lifted tick `boardShoved` puts the board in the air,
the airborne branch of `stepBoard` (`src/engine/player/board.ts`) adds `-HOVER_JUMP_GRAVITY * dt` to `v.y`, the motor
keeps it on the ramp, and the touchdown (`v.y < 0 && position.y <= target + 0.05`) sets `hoverAir = false` and files
`landed(-v.y)` but never zeroes `v.y`. So `v.y` runs down ~5 m/s every 20 ticks (-125 m/s at the ramp's top, x -53.7,
z -116, y 43.75), each touchdown past 9 m/s files a hard-landing fall hit (the player died climbing), and at the ramp's
end the board drops 2 m a tick through the 0.6 m `HOVER_GAP` to the step and falls. The lift itself is tiny: the impulse
decay zeroes the 0.2 m/s feed every tick (it never builds to "UPDRAFT_LIFT / 3.5"). The law is the client Player's own
(bit-identical, sim-player-board.test.ts), so the browser should do the same; a browser probe
(`physics-baseline --route=` with a `start.hover` leg at the ramp foot) teleport did not apply (it drove from the spawn),
so the browser half is unconfirmed. Next: confirm in the browser (teleport the player to the ramp foot, `setHover(true)`,
hold the stick toward the step, log y / vy / health), then the coordinator's ruling on an engine fix (zero `v.y` on the
touchdown, or the updraft feeding the board's own `v.y`), as its own commit with the board-tape oracle re-recorded.

The coordinator's three board gaps: no jump needed (no Sky leg jumps); boarding from rest is honest; the updraft's
onStep is not late in steady state (it reads the position after move N and feeds move N+1, as the browser's fixed.pre
does at tick N+1); the two differ only on a HOVER-toggle tick inside the column, and the tape boards outside it.

## The tape draft

`progress/shard-platform/handoffs/sf72-sky-witness.ts.txt` (copy to `test/proof/far-reach/witness.ts`; Signal's
shape: boot / restore / step / FactIngress / worker). `SkyTape` plays tick commands only: spawn → keeper talk (tick
77) → grove rope bridge, GUST its vane (797) → board over the keeper hover bridge (1393), GUST its vane (1563) → board
over both bridges to the roost (3050) → the three rays felled by fan swings (3987) → ruin rope bridge, GUST (4697) →
back, board to Sunrest (5935) → windmill rope bridge → board up the updraft (fails ~7440, above). Board steering steers
the board's velocity toward 9 m/s along the line (braking into the stop). ~10 s for 7.6k ticks locally.
Still to do: the lint (findLast → a loop, `play` return, the quest lookup), the winch → bridge → crown legs past the
updraft, then the CI budget (ci-green's rule in DEPLOY.md: walk tapes ≤ 10k ticks at 60 s, one checkpoint per test,
`expectSameSimSnapshot`, digests via test/fake/portableMath): split the tape into legs, e.g. a spawn → step test and a
step → crown test resumed from a restore at the step, the gale-wall checkpoint (phase 1, `fight`) in the replay test.
Then flip `run.mjs`, the three tests, `compatibility.json`, determinism.test.ts and the compatibility README.

Plan-State: unchanged.
