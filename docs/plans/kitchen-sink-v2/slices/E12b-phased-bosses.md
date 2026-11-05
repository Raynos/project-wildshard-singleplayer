# E12b: one boss path II: Pine's Antler King and Nalati's Golden King off `plugin/bossPhase`

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **M5.2** (Pine's King: `king.as`,
`custom/kingKit`, ~800 lines of `gen/king*`, `game/server/plugin/bossPhase.ts`) and the Golden King half of **M5.3**, plus the
`bossPhase.ts` slice of SHARD-PLATFORM-NEXT **N2/N5**. A migration slice.

## 1. The showcase piece

None directly; it finishes the path the Crate Titan uses (phases with layers of music, adds, a crown to break).

## 2. Engine / game / host work, just in time

Research:

- `src/game/server/plugin/bossPhase.ts` (1,007 lines) is plugin scaffolding reached through `src/sharddev/phasedBoss.ts` (34
  lines), imported by Pine's `generators/kingFight.ts` and Nalati's `generators/goldenKingArena.ts`.
- Pine's King also uses `bossRow.ts` (retired in E12a), `custom/kingKit` (a live custom section, migration map §7) and
  boss music `layers` with phase gains (the audio plan §1: "a boss slot adds layers (bass, drums) with gains per phase
  1–3 (Pine's Antler King)").
- Nalati's Golden King's intro is already timed as data (`combat/goldenKingRow.ts` `intro`, 4.2 s / 1.4 s;
  IN-GAME-CUTSCENES §1).

Work: express both bosses as E12a's boss rows (phases, moves, adds, reward, intro seconds) with their per-boss logic as
AS (`king.as` stays, re-bound to the host's ABI v1 ports; the Golden King's script likewise); move `custom/kingKit`'s
data into the boss rows and the shard's model rows; delete `plugin/bossPhase.ts` and `sharddev/phasedBoss.ts`.

Host bar: no new host. Guards: `shard-game-plugins`, the custom-section freeze (`kingKit` gone), ratchet. Tests: Pine
King tests (grep `test/*king*`), Nalati kurgan / Golden King tests, `test/fixtures/pine-headless.ts`.

## 3. Other shards in this slice

| Shard | Boss | Parity proof | Save risk |
|---|---|---|---|
| Pine Hollow | the Antler King (camera eases to his ribcage; music layers by phase) | scripted fight replay; a mid-fight save; intro capture before / after (Opus); the music event log per tick | **medium**: `bossesSave` and the fight's mid-phase snapshot |
| Nalati | the Golden King (4.2 s intro: lid opens, he rises, the light shaft) | fight replay; intro capture before / after | medium, same |

## 4. Done when, hours, blockers

**Done when:** both Kings fight, intro and score exactly as before on the one boss host; `bossPhase.ts`,
`phasedBoss.ts` and Pine's `custom/kingKit` are gone.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 4 h | 22 h (Codex; Opus 4 h for captures) | 0 | **26 h** |

**Blockers:** E12a.

## 5. Risks

- 1,007 lines of phase scaffolding hold behaviour nobody listed; read it top to bottom and list each rule before moving
  (into the boss rows, the host, or the boss's AS).

## 6. Questions for Jake

None: approved cleanup (N2/N5, CS8).
