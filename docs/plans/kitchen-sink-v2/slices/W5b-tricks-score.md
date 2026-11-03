# W5b: board tricks and the trick score

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the trick part of the old
**W14** ("trick events → score rows + commons AS"; tricks were M) and the Hover Grip / Hover Boost upgrade effects
(**LE6**'s board rows).

## 1. The showcase piece

- **Tricks:** air time, spins (180 / 360 / 540 by yaw turned in the air), a clean landing (heading within 30° of
  travel), a combo chain (land and launch again within 2 s).
- **Trick score run:** start at the pad, 60 s, score = Σ (air × spin multiplier) × combo; floating trick names
  ("360 · 1.4 s · ×3"); the PB board (W3a records, higher is better).
- **Upgrades take effect:** Hover Grip (tighter turns), Hover Boost (a boost pad on the board), bought in W2b.

## 2. Engine / game / host work, just in time

Research: nothing exists. A repo-wide search for "trick" and "grind" finds only unrelated comments
(`engine/player/dash.ts:57`). The board law (`engine/player/board.ts`) already has the state a trick reader needs
(`hoverAir`, `onGround`, heading).

| Row / mechanic | Shape | Layer |
|---|---|---|
| board events | `board.launch`, `board.land { air, turned, clean }` on the engine event map | engine (movement words only) |
| trick rules | `ui/tricks`: `{ spins: [{ turned: 180, name, mul }], clean: { within: 30 }, combo: { gap: 2 }, run: { seconds: 60 } }` | format rows |
| scoring | commons `tricks.as` reads the events, keeps the combo, writes the run score to records | commons AS (event-driven, ≤ 10 Hz: landings are events) |
| trick words | floating text (the HC3 floating-numbers piece, shared HUD) | engine UI, E332 |
| upgrade effects | `board: { turnMul, boostPad }` effect rows, applied when the owned id is held | game (`loadout/effects.ts`) |

Host bar: board events are engine-general; the trick rows have one user (the showcase): a G595 approval row. Guards:
`engine-words`, HUD E332. Tests: new `board-events.test.ts` (launch/land/turned values from a scripted run),
`tricks-script.test.ts` (score of a known run); `test/hover-boost.test.ts` stays green.

## 3. Other shards in this slice

The board events are emitted on every shard but nobody listens outside the showcase; proof: the board baseline on
Driftwood and Sky (no feel change; the events are reads). No save risk.

## 4. Done when, hours, blockers

**Done when:** a 60 s run in the park scores tricks with floating names, the board keeps the best across a reload,
Hover Grip changes the turn when owned (Developer Scrip row, W2b); other shards' boards feel the same.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Opus: feel and words) | 1 h | 4 h | **19 h** |

**Blockers:** W5a, W3a (records), W2b (upgrades).

## 5. Risks

- Spins on touch: the board turns with the stick; a 360 in 1.4 s of air at today's turn rate may be impossible. Tune
  air turn rate (a row) before scoring.

## 6. Questions for Jake

1. **Trick input on touch.** (a) spins only (stick in the air), no new buttons; (b) add a TRICK button for grabs and
   flips. **Recommended (a):** no HUD change, and spins + air + combos already make a score.
2. **Is the trick score timed?** (a) a 60 s run from the pad; (b) a running best combo with no clock. **Recommended (a):**
   a run has a start and an end, like the other four boards.
