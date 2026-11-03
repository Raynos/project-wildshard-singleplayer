# W5c: grind rails

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). New work (no old row named grinding;
the round-4 census added 3 grind rails).

## 1. The showcase piece

**3 grind rails** in the hover park (a flat 12 m rail, a down-rail off the funbox, a kinked rail into the bowl). Land on
one with the board and you lock to it, slide along at your speed with a spark trail, jump off or ride off the end. A
grind counts in W5b's trick score (`grind` seconds × multiplier).

## 2. Engine / game / host work, just in time

Research: no rail, grind or spline-follow exists for the player (`engine/player/` has walk, board, swim, wade, dash,
dodge; `modes.ts:28` lists driven modes ride, grapple, and approved-not-built glide, climb, drive).

| Row / mechanic | Shape | Layer |
|---|---|---|
| rail rows | `world/rails: [{ id, points: [xyz] (polyline), radius, catch: 0.6 m }]` | format (a new section entry or a `world/traversal` row: `world/traversal` exists and is empty in every product, 30 bytes) |
| board rail law | in the board law: on landing within `catch` of a rail and moving along it, lock to the polyline, carry speed with light friction, release on jump or end | engine `player/board.ts` (a board sub-state; no game nouns) |
| events | `board.grind { seconds }` for W5b | engine |
| sparks | a trail emitter row | game look |

Host bar: rails are engine movement in general; one user: a G595 approval row. Guards: physics ownership (the lock
moves the capsule through the motor, never by teleport). Tests: new `board-rails.test.ts` (catch, carry, release,
snapshot/restore mid-grind).

## 3. Other shards in this slice

None. `world/traversal` is empty everywhere (30-byte sections in all six built products), so filling it changes no one.
Board baselines on Driftwood and Sky unchanged.

## 4. Done when, hours, blockers

**Done when:** all three rails catch a landing, carry and release cleanly, score in the trick run; no snag in the board
baseline.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 16 h (Opus: feel) | 0 | 4 h | **20 h** |

**Blockers:** W5b (scores the grind). Could ship before W5b with no score.

## 5. Risks

- The capsule motor and a moving lock along a kinked polyline: corner snaps must not throw the player. Cap the kink angle
  per rail row (validator).

## 6. Questions for Jake

1. **Grind rails at all?** (a) build them (a new board law, ~20 h); (b) drop rails and give the space to a second
   funbox. **Recommended (a):** rails are what makes a board park read as a park, and the law is small and contained.
