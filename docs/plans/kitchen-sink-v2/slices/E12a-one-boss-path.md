# E12a: one boss path I: the boss row set and host (Driftwood, Sky, Signal, the template)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the core of the old **W11**
("one boss row set: phases, telegraphs, `arenaFire` hazards, `arenaRoom`; fold H110; CS8"), HOST-AUDIT **H043**,
custom-sections **CS8** (combat, boss), and **M5.1** (Driftwood's Captain), **M5.4** (Sky's Roc, Signal's Matriarch) and
**M5.5** (the template boss). The rest of the boss path is E12b (Pine, Nalati's Golden King) and E12c (Nalati's Storm
Titan). The Crate Titan (E12g) is written on the finished path.

## 1. The showcase piece

None yet: the Crate Titan is the path's showcase user (E12g). This slice must leave the path ready for a three-phase,
15 m boss in a portal interior.

## 2. Engine / game / host work, just in time

Research: **five boss classes over one engine brain.** `src/engine/shared/ai/BossBrain.ts` (283 lines; states `dormant |
armed | intro | fight | beat | victory`, `intro` / `introShort` seconds, `SKIP_HOLD`, a music hook) is the shared core.
Over it:

| Path | Where | Users |
|---|---|---|
| 1 encounter rows | `src/game/server/Boss.ts` (`class Boss extends BossBrain`, `:191`; `installBossEncounter(rows, makeScript, ports)`, `:289`) over `src/format/bossEncounter.ts` (354) | Driftwood's Captain (`generators/wakeEncounter.ts`, `src/game/shared/boss/wake.ts`), Pine's King (`kingFight.ts`), the template (`combat/encounters`, kind `boss`) |
| 2 phased boss | `src/game/server/plugin/bossPhase.ts` (1,007) via `src/sdk/phasedBoss.ts` | Pine's Antler King, Nalati's Golden King (E12b) |
| 3 boss row | `src/game/server/shardfile/bossRow.ts` (211; the shield `damage.modify` answer, `:89`) | Pine (`kingFight.ts`, `nativeView.ts`) via `plugin/ui.ts`, `plugin/simulation.ts` |
| 4 arena room | `src/game/server/boss/arenaRoom.ts` (1,641) + `openArenaFight.ts` | Nalati's Storm Titan (E12c) |
| 5 director boss | `DirectorBossBrain` in the director (E11a moved it) | Driftwood's finale |

Profiles live in `src/format/bossProfiles.ts` (709; Sky `rocFight.ts`, Signal `matriarchPresentation.ts`,
`headlessOwners.ts`, Pine, Nalati `kurganRows.ts`), plus `plugin/bossStorm.ts` (40) and Signal's shield answer in
`plugin/ui.ts:1322-1330`.

Work:

| Row / host | Shape | Layer |
|---|---|---|
| boss rows | one `combat/bosses` section: `{ id, body, arena: { volume \| interior }, phases: [{ at, attributes?, moves: [strike ids], adds?, hazards? }], intro: <cutscene id> \| { seconds, short }, music, reward: { first, repeat }, retry }` | format (bossEncounter + bossProfiles folded), `sections.ts` |
| boss host | one game host: phases by HP, beats, telegraphs (strike rows), hazards (E4's rows), adds (stage spawns), shield / guard (E5a's row), reward grants, `boss.attempt` events; per-boss logic as AS on the WASM host | game `src/game/boss/host.ts` (new) from `Boss.ts` + `bossRow.ts` |
| migrate | Driftwood's Captain + finale, Sky's Roc, Signal's Matriarch, the template boss onto it; delete path 3 and Signal's plugin shield answer | shards + game |

Host bar: the boss host has 4+ users after this slice (5 after E12b/E12c). Guards: `engine-words` (`titan`, `captain`
are engine words: they stay in data), `shard-game-plugins`, the custom-section freeze. Tests: every boss test (grep
`test/*boss*`, `test/scripts/_template-boss.test.ts`, `test/driftwood-finale-controller.test.ts`), new
`boss-host.test.ts`.

## 3. Other shards in this slice

| Shard | Boss | Parity proof | Save risk |
|---|---|---|---|
| Driftwood | the Drowned Captain (intro 0 s), the finale | scripted fight replay (phases, HP curve, adds); the finale's reward view; `bossesSave` fixture | **medium**: `bossesSave { defeated, rewardTaken, kills }` keys unchanged |
| Sky Reach | the Storm Roc (1.5 s / 0.3 s intro, yaw snap) | fight replay; intro capture before / after (Opus) | low |
| Signal Dunes | the Dune Matriarch (a marked boss, shield beats) | fight replay with shield beats | low |
| Template | the template boss (intro 1 s) | validate + `_template-boss.test.ts` | none |

## 4. Done when, hours, blockers

**Done when:** the four bosses above run on the one host with their replays identical and their intros unchanged;
`bossRow.ts` and the plugin shield answer are gone.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex) | 16 h (Opus 4 h of it: intro captures) | 0 | **30 h** |

**Blockers:** E11a (the director boss), E4 (hazard rows), E5a (the guard row), E8a (typed rewards).

## 5. Risks

- The riskiest east work with E12b–E12e (KITCHEN-SINK §4: "re-homes five shipped boss intros"). Land one boss per
  commit, replay green each time.

## 6. Questions for Jake

None: W11 / CS8 are approved Wave 1 work.
