# W5a: the hover park's ground (kickers, halfpipe, quarter pipes, funbox, bowl) and the board look in game

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the board half of the old
**W14** ("move the board to game", HOST-AUDIT **HA4d**, owned there, run here) with a correction (§2).

## 1. The showcase piece

Zone 11, hover park 134 × 122 (`layout.js` `HOVER`):

| Item | Rows |
|---|---|
| 3 kickers | 1.6, 2.4, 3.2 m on 45 m cyan run-ups (Q2: taller?) |
| Halfpipe | 45 m long; ridden as two launch walls (Q1) |
| 2 quarter pipes, a funbox (4 ramps), the bowl ⌀24 m | collider geometry + polished look |
| Trick-score start pad and PB board | placed now; scoring in W5b |
| Gold ●5 on the halfpipe lip | W9b places it |

## 2. Engine / game / host work, just in time

Research, and a correction to the old row:

- **The board's motor law belongs in the engine.** `src/engine/player/board.ts` (129 lines) is a motor mode beside
  walk / swim / wade (`src/engine/player/modes.ts:26` `MotorMode = 'foot' | 'board' | 'swim' | 'wade'`): ride height
  0.45 m on a spring over "terrain, platform, collider floor or water", jump 9.5 m/s, air gravity 15. Every shard and
  the highway use it. Moving it to game would break the engine's own movement set; HA4d's real target is the **board's
  look**: `src/engine/models/hoverboard.ts` (29 lines) and `src/engine/render/hoverboardGeometry.ts` (55), a Wildshard
  prop in the engine, imported by `game/models/explorerCatalogue.ts` and `game/systems/tools/hoverboard.ts` (the
  `Hoverboard` tool, already in game). Move those two files to `src/game/models/` (Q3).
- **The board can't ride a wall.** The spring tracks the floor straight below (`CharacterMotor.ts:92` "a move that
  ignores the terrain heightfield … they ride their own springs over it"), so a vertical halfpipe wall can't be ridden;
  a transition up to ~45° launches you instead. A true vert halfpipe needs surface-aligned riding: a new motor law.
- **Board-only colliders** (`mode: 'board'` pieces in `src/game/plugin/simulation.ts:86-103`, Sky Reach's hover-only
  bridges) are plugin scaffolding with one user; the park doesn't need them (hover-only bridges are content-out, §2).

Work: the park is geometry and colliders (Blender, Opus). Platform: move the two board-look files to game (no behaviour
change). Guards: `layer` (engine → game move), `engine-words`. Tests: `test/hover-boost.test.ts`, `physics/board-mesh-collision.test.ts`,
the Explorer catalogue tests; `physics-baseline --mode=walk` 0 stuck in the park.

## 3. Other shards in this slice

Every shard shows the board (the highway, every cell). The move changes import paths only: the board's look is
pixel-identical (a before/after capture on Driftwood's road and Sky Reach, Opus). Sky's board-only bridges are not
touched. No save risk.

## 4. Done when, hours, blockers

**Done when:** the park is rideable end to end: every kicker launches, the halfpipe and quarter pipes send you up and
back, the bowl carves, nothing snags (walk and board baselines 0 stuck); the board look files live in game; Driftwood
and Sky board captures unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 4 h | 4 h | 16 h (Opus: park geometry, colliders, look) | **24 h** |

**Blockers:** W0b (Park Gate).

## 5. Risks

- Round 4 says the park "reads as a flat floor with ramps" at eye height; taller ramps (Q2) fix the read but cost
  run-up length inside 134 × 122.

## 6. Questions for Jake

1. **The halfpipe.** (a) launch walls up to ~45° (today's board: you fly up and drop back in); (b) a new surface-aligned
   board law so you ride a vertical wall (vert). **Recommended (a)** now: (b) is an engine motor rewrite for one toy;
   it can be a later slice if (a) feels wrong in play.
2. **Taller ramps** (open in STATE). (a) kickers 2.4 / 3.6 / 4.8 m and a 6 m halfpipe; (b) round 4's 1.6 / 2.4 / 3.2.
   **Recommended (a):** the park reads at eye height and the jumps feel like a showcase; run-ups still fit at 45 m.
3. **HA4d for the board.** (a) move only the board's look (model, geometry) to game, keep the motor law in the engine;
   (b) move the law too. **Recommended (a):** the law is movement like swimming; the look is the Wildshard part.
