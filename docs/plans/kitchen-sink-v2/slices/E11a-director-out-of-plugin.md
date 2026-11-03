# E11a: the wave director out of the plugin (a game host; every director user migrated)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the director half of the old
**W4** (W6a took the mover half), the `director.ts` slice of SHARD-PLATFORM-NEXT **N2/N5** (owned there, run here),
HOST-AUDIT **HA4e** for the director route and the **M4.2 / M6.5** director parts. A migration slice; its showcase piece
is the gauntlet (E11c).

## 1. The showcase piece

None on its own: the gauntlet's run director (E11b/E11c) is the first new user, written against the moved host.

## 2. Engine / game / host work, just in time

Research:

- `src/game/plugin/director.ts` (435 lines) is plugin scaffolding holding four things: the v1 typed-event director
  (`DirectorLane`, `prepareDirectorModule`, `readDirectorProduct`, `:44-161`; Driftwood's `director.as` /
  `directorV2.as` / `returns.as`, Pine's `director.as` / `directorV2.as` / `director.json`), the v2 stage lane
  (`DirectorStageLane`, `:162`, over `format/directorStages.ts`), the action binder (`bindDirectorActions`, `:253`) and
  a script stage lane plus **`DirectorBossBrain extends BossBrain`** (`:315`, `:399`: Driftwood's finale).
- Importers: `src/game/quest/chapterDirector.ts`, `chapterClock.ts`, `src/game/shardfile/walkInPortalRide.ts:6`,
  `clientQuestPage.ts`, `bossRow.ts`, `src/format/platformFileFamilies.ts`, and ~12 tests (`test/director-*.test.ts`,
  `test/driftwood-finale-controller.test.ts`, `test/chapter-director-product.test.ts`, the headless fixtures).
- v2 stage users (`quests/directors`): Nine (`nine.portal-ride`), Sky (`far.roc.encounter`), Signal
  (`sunscar.matriarch.encounter`), the template (`template.door-wave`).

Work: move the director to `src/game/world/director/` in three modules (v1 lane, v2 stage lane + actions, the director
boss brain, which E12a folds into the one boss path), update the importers, delete the plugin file. No row change.
Layer: game (a world host reached from rows). Guards: the `shard-game-plugins` ratchet, `layer`, `public-index` (new
exports in `src/game/package.json`). Tests: every director test above, unchanged.

## 3. Other shards in this slice

| Shard | Director | Parity proof | Save risk |
|---|---|---|---|
| Driftwood | v1 director + finale boss brain, `returns.as` | headless replay (`test/fixtures/driftwood-headless.ts`): same events, same finale | **medium**: director state is saved (`bindDirectorActions` snapshot / restore); a mid-finale save fixture |
| Pine | v1 director (night thralls) | `test/fixtures/pine-headless.ts` replay over a night | medium, same |
| Sky, Signal | v2 boss encounter directors | the roc and Matriarch fight replays | low |
| Nine | v2 portal ride | `test/declared-portal-entry.test.ts` | none |
| Template | `template.door-wave` | validate | none |

## 4. Done when, hours, blockers

**Done when:** `src/game/plugin/director.ts` is gone; every product's director replay matches tick for tick; mid-run
save fixtures restore.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex) | 16 h | 0 | **24 h** |

**Blockers:** none in the east (W6a moved its sibling and set the pattern). Independent of E0–E10; can run from day 1.

## 5. Risks

- Same shape as W6a's move: land the move with identical behaviour first (replays green), then anything new.

## 6. Questions for Jake

None: N2/N5 are approved, owned by SHARD-PLATFORM-NEXT and run here.
