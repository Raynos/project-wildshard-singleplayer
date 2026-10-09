# Handoff (sf72-sky) — 2026-10-09, SF72 Sky Reach headless, part 4 (sf72-sky4, 90-min cap)

Coordinator `wildshard-new` pushes. Landed locally with a private index + old-value CAS. Sky's canonical witness
(`test/proof/far-reach/`) is UNCHANGED and still fails closed. The played headless host now owns the 13 bodies, the Roc
encounter, the War Fan, the quest and the movers (islets, road gates, winch bridge), all exact across a native restore.

## Landed

- Parts 1-3: `defff10d1`, `66330c07b`, `3361c50c3`, `43d7928cd`, `0d9ed5741` (see git log).
- Part 4, slice 1 `08c95025f`: the Roc falls to War Fan play alone (the labelled chip is gone); `runtime/quest.ts` (four
  steps on `DeclaredQuests`, `far-reach.quest` + 10 coins once) tested on a fresh host with movers.
  - `runtime/fan.ts`: HEAVY / GUST aim along the yaw at the tick's `far.fan.aim` pitch (script command, radians, clamped
    to the Player's ±1.45; the browser aims them along the camera ray). Without it the gale-wall phase is unwinnable:
    the Roc hovers at CROWN.y + 7, 5.3 m above the eye, out of every level move's reach.
- Part 4, slice 2 (this commit): the movers in the played host (the engine fix `91e1ad4b7`); `prepareSkyRuntime` returns
  `{ plan, installSky }` (installSky returns the host's `SkyMovers`). Quest test plays all four steps on the played host and
  restores mid-raise byte-exactly (paid once, on both hosts). headless-runtime 14/14 incl. restores at 0/1/700/2600 and
  mid-Roc 900/2000 with the movers installed.

## Blockers / findings (for the coordinator)

1. **The full traversal needs the hoverboard.** The roost (`far.hover.roost`), the keeper isle (`far.hover.keeper`) and the
   high step (`far.updraft`, the winch and the crown bridge's foot) are reachable only on the board: hover decks and the
   updraft collide only in board mode (runtime/index.ts `board()`), and the headless world leaves them out (inactive in
   the bake). The SimHost player has no board mode. So the whole-shard witness can't walk spawn → crown by tick commands
   until the SDK / host owns a board mode (mode command, hover deck colliders gated on it, the updraft's lift) — an
   engine/SDK seam, the coordinator's call. The quest test stages the player onto each deck (`stand`) and says so.
2. **The Roc's gale wall holds still 27 s** (browser too): `GALE_WALL` is a `lane` strike with no `motion`, and
   `StrikeRunner` treats every lane as a charge, so `active` lasts length 26 / max(1, speed 0) + 1.2 = 27.2 s. Phase 2 by
   pure fan play takes ~20k ticks because of it. Not changed (behaviour change, Jake's call).

## Exact next steps

1. Board mode in the host (above), then the witness tape: spawn → keeper (talk) → windmill / grove rope bridges → board to
   the roost (fan the three rays) → vanes (gust each, `far.fan.aim`) → updraft to the step → winch → walk the raised
   bridge → crown fight (copy `crownFight` from headless-runtime.test.ts). Copy Signal's `test/proof/sunscar-dunes/witness.ts`
   shape (boot / restore / step / FactIngress / worker cross-check); entry `runtime/headless.ts`.
2. Replay: checkpoint in the gale-wall phase (`phase 1`, state `fight`), byte-exact restore, suffix to victory, the
   shipping worker 60 ticks. Ledger: both facts (`far-reach.quest`, `far-reach.roc`) granted once, durable, no re-emit.
3. Flip `test/proof/far-reach/{run.mjs,headless,replay,ledger}.test.ts` and `compatibility.json` from that real run.

## Proof receipts (slice 2)

- Clean export of `ba527e920` + these files: strict tsc, oxlint, ratchet, coupling green; check-graph: none new or rising
  (slice 1's far-reach → game 35 → 37, → engine 126 → 127 approved). Sky tests: headless-runtime 14/14, headless-quest 2/2.
- No browser-reachable module changed (runtime/{fan,quest,headless}.ts are imported only by the headless entry and tests).

Plan-State: unchanged.
