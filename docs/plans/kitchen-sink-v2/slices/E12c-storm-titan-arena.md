# E12c: one boss path III: Nalati's Storm Titan arena fight onto the boss host (H110)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the Storm Titan half of **M5.3**,
HOST-AUDIT **H110** (the arena room as a one-boss host) and the hazard half of **W11** (`arenaFire` hazards). E10a
already moved the room's enter / leave lifecycle to the interior host; this moves the fight. A migration slice.

## 1. The showcase piece

None directly. It proves the boss host can run a boss **inside an interior** with arena hazards, which is exactly the
Crate Titan's shape (E12g).

## 2. Engine / game / host work, just in time

Research:

- `src/game/boss/arenaRoom.ts` (1,641 lines) still owns the fight after E10a: "the single ordered boss/room update",
  the row-driven arena brain (`:462-494`), the client adapter over the boss host (`:495`), private scenes and the
  reward light (`:581`); `openArenaFight.ts`, `arenaAnswers.ts`, `arenaCollision.ts`, `arenaGround.ts` (a deformable
  floor), `arenaWhirls.ts`, `arenaFire.ts` (whose drawing E4 already lifted to the shared hazard view).
- Nalati ships 13 `titan*.as` scripts (migration map §1) and the fire's `burnSeconds` / `fireDps`
  (`src/format/bossProfiles.ts:292`).
- Consumers of `arenaRoom`: Nalati `generators/output.ts`, `game/quest/pageComposition.ts`,
  `game/shardfile/entryOwners.ts`, `clientTargets.ts`, `worldAssembly.ts`, `worldUpdates.ts`, `game/looks/speciesBook.ts`.

Work: the Storm Titan becomes a boss row whose `arena` is an interior (E10a); its phases, the bolts, the fire and the
whirls become strikes, E4's hazard rows (burn via E0g's `effect.burn`) and arena rows; the deformable floor stays as an
arena look row; the 13 AS files bind to the boss host's ports. What is left of `arenaRoom.ts` is presentation (listed
view code) or deleted.

Host bar: the boss host's interior arena gets its first user (the Crate Titan is the second). Guards:
`shard-game-plugins`, ratchet (`arenaRoom.ts` lines count down). Tests: `test/arena-portal.test.ts`, the arena tests
(grep `arena`), Nalati product tests.

## 3. Other shards in this slice

| Shard | Parity proof | Save risk |
|---|---|---|
| Nalati | scripted Storm Titan fight replay (phases, bolts, fire, whirls, HP curve); arena goldens of each phase (Opus); a mid-fight save; the 3.6 s / 1.3 s intro capture | **medium**: the arena's fight snapshot; fixture inside phase 2 |

## 4. Done when, hours, blockers

**Done when:** the Storm Titan fights on the boss host inside its interior, every phase pixel-identical and replay-
identical; `arenaRoom.ts` holds no fight logic; the burn is E0g's effect.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 4 h | 22 h (Codex; Opus 6 h for goldens) | 0 | **26 h** |

**Blockers:** E12a, E10a, E4, E0g.

## 5. Risks

- G808's light-pool rule (`arenaRoom.ts:581-586`): the arena's spare light must keep its slot or a grid crossing into
  Nalati relinks 83 programs again.

## 6. Questions for Jake

None: approved cleanup (H110, CS8).
