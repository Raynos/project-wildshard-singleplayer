# W8b: scramble climbing (the scramble wall, the Rock's south route)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the scramble part of the old
**W18** ("build the `climb` mode for scramble surfaces"; scramble was M).

## 1. The showcase piece

- **The scramble wall** up to the climb yard's deck A (6 m), a slab of holds at ~70°.
- **The Rock's scramble route** up its south face to the lookout (16 m), in three pitches with ledges to rest on.

## 2. Engine / game / host work, just in time

Research: no climb mode exists. `src/engine/player/modes.ts:27-28`: "The approved modes a level brings (G3): ride and
grapple ship; glide, climb and drive are approved, not yet built" (`DrivenMode = 'ride' | 'grapple' | 'glide' | 'climb'
| 'drive'`). The walk law refuses slopes past `MAX_CLIMB_DEG` (`engine/player/Player.ts:47`); `climbTo` in `Player.ts:132`
is the swim exit, not climbing.

| Row / mechanic | Shape | Layer |
|---|---|---|
| scramble surfaces | `state/modes` `traverse: [{ kind: 'scramble', id, quad: [4 xyz] (a planar face), top: { exit }, speed: 1.2 m/s, stamina?: s }]` | format `modes.ts` (a fourth traverse kind) |
| climb law | a driven mode `climb`: attach when you walk into a scramble face, move in the face's plane with the stick, mantle onto `exit` at the top, let go with jump (a small push-off) | engine `player/modes.ts` + a law beside `ladder.ts` (move `ladder.ts`'s capsule pattern), client and headless |
| look | hands on holds: two arm poses alternating; a dust puff on a mantle | game (first-person arms) |

Host bar: one user (G595 row); climb is an approved mode name (G3). Guards: physics ownership (the capsule moves only
through the motor). Tests: new `scramble-climb.test.ts` (attach, move, mantle, release, snapshot/restore mid-climb,
headless and client agree).

## 3. Other shards in this slice

None. The `DrivenMode` union already names `climb`; no other shard declares scramble rows.

## 4. Done when, hours, blockers

**Done when:** you scramble up the wall to deck A and the Rock's three pitches to the lookout, mantle at each top, can
let go and drop; client and headless agree; walk baseline 0 stuck.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 24 h (Opus: feel, arms) | 0 | 4 h | **28 h** |

**Blockers:** W8a (the yard), W9a for the Rock's route (the wall alone can ship first).

## 5. Risks

- The largest new movement law in the west. Keep it planar (one quad per face); curved rock is several quads with
  ledges between them, not a general surface climber.

## 6. Questions for Jake

1. **Stamina?** (a) none: climb as long as you like; (b) a stamina bar that drops you after ~10 s on a face.
   **Recommended (a):** the west is practice; ledges between pitches already pace it, and a bar is HUD.
2. **Scramble beyond the marked faces?** (a) only declared scramble faces; (b) any steep rock. **Recommended (a):** (b)
   means climbing everything in every shard, which is a different game.
