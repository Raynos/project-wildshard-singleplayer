# W6b: conveyor belts and jump pads

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the old **W9** ("a
surface-velocity box row and a launch trigger row in the character motor").

## 1. The showcase piece

Movers run stations 1–2:

| Station | Rows |
|---|---|
| 1 conveyors ×3 | belts alternating direction (3 m/s, −4 m/s, 5 m/s): walk against or with them; crates ride them (W4a bodies) |
| 2 jump pads ×3 | each launches to the next ledge, up to a 6 m ledge |

## 2. Engine / game / host work, just in time

Research: the player has a transient-impulse law shared by client and headless sim (`src/engine/shared/player/impulse.ts`:
"a shove (a wisp's burst, a gale wall, an updraft) adds world velocity in m/s … after each step the impulse decays";
`src/engine/server/sim.ts:619` lifts the board on an upward shove). Sky Reach declares **updraft** columns as `state/modes`
traverse rows (`src/format/modes.ts` `UpdraftModeSchema`, read in `src/game/server/shardfile/dataCreaturePorts.ts:22,33,48`).
Kinematic decks carry the motor (`engine/shared/physics/CharacterMotor.ts:339` `carry`). No surface velocity exists: colliders
carry only a material tag (`engine/shared/physics/surface.ts:13,22`).

| Row / mechanic | Shape | Layer |
|---|---|---|
| `launch` traverse row | `{ kind: 'launch', id, box, velocity: [x, y, z], cooldown }`: on entering the box, one impulse (the updraft's sibling: same law, one shot) | format `modes.ts` + engine impulse; game reader beside the updraft in `dataCreaturePorts.ts` |
| `conveyor` traverse row | `{ kind: 'conveyor', id, box, velocity: [x, z] }`: feet on a collider inside the box add the belt's velocity to the motor step; declared bodies on it get the same drive | engine motor step + bodies |
| belt look | a scrolling UV on the belt mesh (a material param channel) | game look |

Host bar: the traverse-row family has Sky's updraft as its existing user; `launch` shares its law (two users of the
impulse path); `conveyor` has one user (G595 row). Guards: physics ownership; `engine-words`. Tests: new
`traverse-launch.test.ts`, `traverse-conveyor.test.ts` (client and headless agree, snapshot/restore); Sky's updraft
tests stay green (`test/isolated-shard-*` Sky values, the far-reach product test).

## 3. Other shards in this slice

Sky Reach: the updraft reader is extended, not changed; proof: updraft replays the same lift per tick, a ride up the
Sky crown column in game. No save risk.

## 4. Done when, hours, blockers

**Done when:** the three belts move you and crates at their speeds, the pads land you on each ledge from a standing
step-on, client and headless agree; Sky's updrafts unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex law; Opus feel) | 2 h | 6 h | **22 h** |

**Blockers:** W0b. Runs beside W6a.

## 5. Risks

- A belt under a board rider: the board ignores the heightfield and rides its own spring; decide whether belts push
  boards (Q1).

## 6. Questions for Jake

1. **Do belts move a hoverboard?** (a) no, belts push feet and crates only; (b) yes. **Recommended (a):** the board is how
   you skip the belts on a second run, a small reward for knowing.
