# E1g: kill and collect counters, the level gate on quests, tier-1 quests

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **QC3** (counter steps: kill N
of a type, hold N of an item), the level half of **QC1** and **LV8**'s quest `minLevel` (W1b shipped the flag-driven
grey / yellow "!"; this adds the `level ≥ n` atom), and the first tier-1 quests of **QK1** / **LS5**.

## 1. The showcase piece

The tier-1 giver (L1–6) offers two playable quests: **Clock In** (L1: kill 5 Crate Mites at the east gate, a checkpoint
card) and **Spare Servos** (L2: bring Tinker Rook 6 Servos; first upgrade unlocked). The tier-2 and tier-3 givers'
quests now show a **grey "!"** until your level reaches theirs, then yellow.

## 2. Engine / game / host work, just in time

Research:

- A step's `done` is a condition over flags; `count` is a list of flags counted as set (`src/format/quests.ts:12`); no
  step counts kills or items. Quest `onComplete` pays at most 100 coins (`:13`).
- **Kill counters exist outside quests**: achievement rows `{ count, kind, variant, event }` (`src/format/quests.ts:23`)
  and counter flags `method: 'event' | 'count'` (`src/format/achievementCounters.ts:10-18`), fed by
  `Progress.recordKill(kind, variant)` (`src/game/Progress.ts`). They count lifetime kills, not "since you accepted".
- Item counts: the pack's `inventorySave` (`src/game/saves.ts:12`).
- W1b adds `giver`, `visibleWhen`, accept / turn-in, `discover` and `checkpoint` steps.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| kill step | `{ kind: 'kill', match: { kind, variant? }, need: n, since: 'accept' }`: counts non-grey kills after the quest's accept flag; saved in the quest's progress | format `quests.ts` step + game step runner |
| hold step | `{ kind: 'hold', item, need: n, take?: boolean }`: done while the pack holds n; `take` removes them at turn-in | format + game |
| level atom | conditions gain `{ level: n }` (true when the shard's level ≥ n; false on flat shards: they never use it) | format condition + game (reads E0d) |
| rewards | `onComplete.grants` uses the typed grants (W2b); the `coins ≤ 100` field stays for flat shards | format |

Host bar: extends the 5-user quest host (W1b). Guards: `engine-words`, `no-url-switch`. Tests: extend
`test/author-quest-data.test.ts`, `test/quest-step-runner.test.ts`, `test/quest-flag-gates.test.ts`; new
`quest-counter-steps.test.ts` (counts since accept, grey kills don't count, `take` removes items, the level atom).

## 3. Other shards in this slice

Every quest shard (Driftwood, Pine's declared quests, Nalati, Sky, Signal, templates) uses none of the new step kinds or
atoms; their quest data parses and runs as before (`test/driftwood-quest-content-product.test.ts`,
`test/nalati-chapter-one.test.ts`, `test/quest-step-traces.test.ts`). No save risk (new fields only).

## 4. Done when, hours, blockers

**Done when:** Clock In and Spare Servos play end to end with their checkpoint cards and "?" turn-ins; tier-2 / 3
givers show grey until L7 / L13; other shards' quest chains replay unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Codex) | 4 h | 6 h (two quests, NPC lines) | **22 h** |

**Blockers:** W1b, E1c, E1e (Servos), E0d (levels).

## 5. Risks

- "Since accept" needs the accept flag to exist; W1b's default "accepted when startable" would make every kill count
  from the moment the quest is visible: kill quests set an explicit accept.

## 6. Questions for Jake

1. **Hand-in items.** (a) Spare Servos takes the 6 Servos at turn-in; (b) you keep them (the quest only checks).
   **Recommended (a):** a hand-in that costs nothing isn't a fetch quest, and Servos respawn every 90 s.
