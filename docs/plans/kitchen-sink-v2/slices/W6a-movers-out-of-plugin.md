# W6a: movers out of the plugin (sliders, the spinner, the lift)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the mover half of the old
**W4** (the director half is east: E-slices), the `mover.ts` slice of SHARD-PLATFORM-NEXT **N2/N5** (owned there, run
here), HOST-AUDIT **HA4e** for the mover route, and **M6.5** (Pine / Nine / Sky / Signal movers).

## 1. The showcase piece

Zone 05, the movers run 98 × 58 (`layout.js` `MOVERS`), stations 3–5:

| Station | Rows |
|---|---|
| 3 sliding platforms ×3 over a pit | `world/movers` `track` drivers, `pingpong`, staggered phases; a fall drops you to the pit floor and a ladder back (W8a) |
| 4 spinner | a turning disc (`track` with a yaw key loop) and a sweep arm that shoves you off (`track` + the impulse law) |
| 5 lift 6 → 18 m | a `winch` driver, `stand` trigger (ride when you stand on it) |

## 2. Engine / game / host work, just in time

Research:

- **The engine half has already moved:** `src/engine/shared/sim/moverMotion.ts` (130 lines), `moverLifecycle.ts` (80),
  `src/engine/shared/physics/mover.ts` (`KinematicMover`: "a kinematic deck moves before the world step and carries the existing
  CharacterMotor"). Rows: `src/format/movers.ts` (220), `moverMotion.ts` (271; drivers `always | interact | stand |
  shared | static | track | pendulum | waves | winch`).
- **The host is still plugin scaffolding:** `src/game/server/plugin/mover.ts` (599 lines) holds `createMoverHost`,
  `MoverRuntime`, `installDeclaredMovers`, `MoverScriptDriver`, `createComposedMoverHost` and, unrelated,
  `proveTerrainEntries` (line 46). Importers: `game/client/shardfile/hybrid.ts`, `decisions.ts`, `sceneMotion.ts`,
  `clientMoverOwners.ts`, `game/client/quest/pageFacets.ts`, `pageComposition.ts`, `declaredPage.ts`, `game/cook/bake/entryways.ts`.
  It also owns Driftwood's rope bridge (`RopeChain`, the `chain` mover kind), which W6c generalises.
- **Users (built products, `world/movers`):** Sky Reach 40 KB (10 static, 9 winch, 9 interact, 5 platform, 3 always),
  Driftwood 6.4 KB (always, chain, platform, static, waves), Pine 1 KB (winch, interact, channel), Signal 0.6 KB (track,
  interact, channel); Nalati and Nine ship empty sections (Nine drives its own movers through a view wasm,
  `nine.movers`, `generators/productOutput.ts:112`).

Work: move the mover host to `src/game/world/movers/` (runtime, script driver, composition), move
`proveTerrainEntries` to `game/cook/bake/entryways.ts` where its only caller is, delete the plugin file. No row change. Layer:
game (a Wildshard world host reached from client-plan rows). Guards: the `shard-game-plugins` ratchet, `layer`,
`public-index` (new module path in `src/game/package.json` exports). Tests: `test/mover-mechanic.test.ts`,
`test/mover-carry.test.ts`, `test/mover-bake-output.test.ts`, `test/client-mover-owners.test.ts`,
`test/driftwood-mover-entry.test.ts`.

## 3. Other shards in this slice

| Shard | Movers | Parity proof | Save risk |
|---|---|---|---|
| Sky Reach | 36 rows: winch lifts, interact platforms | mover replay (same poses per tick for 60 s, `test/mover-mechanic.test.ts` fixture per product); ride the winch house in game | **medium**: mover state is in the physics snapshot (`MoverLifecycleStateSchema`); a mid-ride save fixture restores at the same pose |
| Driftwood | waves deck, chain bridge, platforms | replay + `test/driftwood-mover-entry.test.ts`; cross the bridge | medium, same |
| Pine | one winch, one interact | replay | low |
| Signal | one track | replay | low |
| Nine | view-wasm movers, not this host | none (not touched) | none |

`node scripts/physics-baseline.mjs --no-build --mode=walk` 0 stuck on each.

## 4. Done when, hours, blockers

**Done when:** `src/game/server/plugin/mover.ts` is gone; the showcase's sliders, spinner and lift run; every product's mover
replay matches tick for tick; mid-ride save fixtures restore.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 18 h (Codex) | 16 h | 6 h (stations 3–5) | **40 h** |

**Blockers:** W0b (Movers Gate). Independent of W1–W5.

## 5. Risks

- The biggest code move in the west (599 lines, eight importers, four shards' saves). Land it in two commits: the move
  with identical behaviour first (replays green), then the showcase rows.
- The spinner's sweep arm shoving the player relies on the motor's push; if it pins you against the disc, the arm gets
  a soft impulse row (W6b's launch) instead.

## 6. Questions for Jake

1. **What happens when you fall in the pit.** (a) a ladder back to the start (W8a's first ladder); (b) respawn at the
   station start with a fade. **Recommended (a):** no fade, no lost flow, and the pit is shallow.
