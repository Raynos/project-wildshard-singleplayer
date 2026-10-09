# Handoff (sf72-sky) — 2026-10-09, SF72 Sky Reach headless, part 5 (sf72-sky5, 90-min cap)

Coordinator `wildshard-new` pushes. Landed locally with a private index + old-value CAS. Sky's canonical witness
(`test/proof/far-reach/`) is UNCHANGED and still fails closed: the spawn-to-crown tape waits on the hoverboard seam
(sf72-board: SimHost board mode with board-only colliders). No board SHA had landed by this lane's cap.

## Landed

- Parts 1-4: `defff10d1`, `66330c07b`, `3361c50c3`, `43d7928cd`, `0d9ed5741`, `08c95025f`, `f8f901eec` (see git log).
- Part 5, step 1 `77f41047c`: **the gale-wall strike fix** (`src/engine/ai/strikes.ts`). Only a lane with `motion` is a
  charge (runs to its end or `length / max(1, speed) + 1.2 s`); a motionless lane keeps its full strip for contact and
  ends at its declared `active`, so GALE_WALL holds 0.6 s (was 27.2 s). The goat RAM declares `motion: {}` (no runner
  speed: ramSpeed 7.5 would cut normal ~1.87 s rams at 1.73 s, because RamGrazerBrain's ramp starts 0.8 s into active).
  - `test/shards/far-reach/goat-ram-oracle.test.ts`: seven goat-ram scenarios (incl. a blocked ram that runs to the
    timeout) hashed on HEAD before the change, byte-identical after.
  - The source-hashed capture `test/fixtures/grazer-oracle/goat.ts` keeps its bytes (test/grazer-oracle.test.ts
    hashes it); ram-grazer.test.ts and flying-brain-binding.test.ts give its RAM `motion: {}` at load.
  - Browser (muted Chromium "iPhone 16 Pro", export dist): the phase-2 gale wall shows 7.0 s = 1.5 + 0.6 + 1.4 + 3.5
    (was 33.6 s), the Roc still; boot smoke standalone + grid PASS; Sky walk baseline 0 stuck.
- Part 5, step 2 `98a77044c`: **bands**. Sky's headless flock runs on `host.useBodyBands({ rate: () => 'legacy' })`,
  the page AnimalManager's rate for a self-thinking species: decisions on the legacy clock (10 Hz, the step the time
  since the last decision, taken alive or not), the body every tick at any distance, the page capsule only within 45 m
  (released past 55 m). Restores stay byte-exact (headless-runtime 15/15, quest 2/2).

## Exact next steps (step 3 of the brief, once sf72-board's SHA lands)

1. Sky's physics bake (`scripts/bake-sky-physics.mjs`; coordinate the edit through the coordinator, sf72-board touches
   it) captures the board-mode colliders: the hover decks (`far.hover.roost`, `far.hover.keeper`) and the updraft volume
   (`far.updraft`), today inactive in the bake (runtime/index.ts `board()` enables them only in board mode).
2. The witness tape, entry `runtime/headless.ts`, shape copied from Signal's `test/proof/sunscar-dunes/witness.ts`
   (boot / restore / step / FactIngress / worker cross-check): spawn → keeper (talk) → windmill / grove rope bridges →
   board to the roost (fan the three rays) → vanes (GUST each with `far.fan.aim`) → updraft to the step → winch → walk
   the raised bridge → crown fight (copy `crownFight` from headless-runtime.test.ts). Phase 2 is now short (the wall
   holds 0.6 s), so fan play no longer needs ~20k ticks there.
3. Replay: checkpoint in the gale-wall phase (`phase 1`, state `fight`), byte-exact restore, suffix to victory, the
   shipping worker 60 ticks. Ledger: both facts (`far-reach.quest`, `far-reach.roc`) granted once, durable, no re-emit.
4. Flip `test/proof/far-reach/{run.mjs,headless,replay,ledger}.test.ts` and `compatibility.json` from that real run.

## Proof receipts (part 5)

- Clean exports (HEAD + each change): full suite 1019 / 5666 (step 1) and 1021 / 5676 (step 2) green; Signal's witness,
  Pine's proofs and the Pine strike snapshot unchanged; tsc, oxlint, ratchet, pre-commit hooks (generated, graph,
  asks, guards) green. No graph or debt change.

Plan-State: unchanged.
