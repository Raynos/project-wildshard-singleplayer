# W1b: the quest board, giver markers and a parallel quest log

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs **QC1** (marker states, the
level half moves to E0), **QC2** (parallel freeform quests), **QC4** (discover-N step), **QC6** (checkpoint card), the
quest part of the old **W5**, **HC6** (giver "!" markers), and **M2.3/M2.4/M2.5/M2.6**'s parity duty for every shard
already on the declared quest path.

## 1. The showcase piece

- The plaza's **quest board** and the three givers (W1a) offer the **12 quests** as rows (quests mini plan table), each
  with its tier, `visibleWhen` and `startWhen`, steps and checkpoint cards. Their kill / collect / set-piece steps point
  at east content, so in the west they show, can be accepted, and wait.
- **Giver markers:** grey "!" (visible, not yet startable), yellow "!" (startable), "?" (ready to turn in), none (done),
  over the giver and on the minimap.
- **A west tour quest** if Jake agrees (Q1): "Shift Orientation" from the Yard Boss: visit the five course start boards
  (range, park, movers, grapple, riding) with a `discover N of` step, a checkpoint card per leg, no reward (the west
  pays nothing). It is the only quest playable end to end in the west, and it proves QC2/QC4/QC6 before any enemy exists.

## 2. Engine / game / host work, just in time

Research:

- **Quest rows:** `src/format/quests.ts` (331 lines): `quest {id, title, track?, completeFlag, startWhen?, intro?, steps[],
  onComplete {fact, scene, coins ≤ 100}}`, steps `{objective, chip, hint, done, count, markers}`, conditions over flags
  (line 8). Several quests already coexist, each gated by `startWhen`. Users: Driftwood (4 KB), Pine (5.6 KB, plus its
  custom `questRuntime`, W1c), Nalati (8.2 KB, chapters), Sky (1.9 KB), Signal (2.9 KB), Nine (64 B, empty).
- **The UI shows one quest.** The HUD has one objective chip (`src/engine/ui/HUD.ts:572` `.ws-quest-obj`) and the map tab
  one quest card (`src/engine/ui/Menu.ts:352` `renderQuest()` reads a single `fullMap.quest`). No quest list, no accept,
  no turn-in, no giver marker exists.
- **Discovery** exists (`src/engine/quest/discovery.ts`, 45 lines); no "discover N of these places" step.

Work (data-only rows, game layer):

| Row | Shape | Layer, why |
|---|---|---|
| quest `giver` | `giver: <npc id>`, `turnIn: <npc id>?` | format + game: who offers it, where the "?" shows |
| quest `visibleWhen` | condition (flags now; E0 adds the `level ≥ n` atom) | format: grey "!" = visible ∧ ¬startable; no level system needed yet (19z keeps levels out of other shards) |
| accept / turn-in | dialogue choice `sets: ['accept:<quest>']`, quest `acceptFlag` | rows only; dialogue choices already set flags |
| step `discover` | `{ kind: 'discover', places: [ids], need: n }` | game quest steps (QC4) |
| step `card` | `{ checkpoint: { title, text, leg: [i, n] } }` saves on show | game (QC6) |
| quest log | a QUESTS list on the map tab: tier, level, state; one **tracked** quest feeds the HUD chip | engine UI (`Menu.ts`), data from the game: a HUD change, so E332 notice + Jake's pick first |
| giver marker | world marker + minimap pin by giver state | game over engine `Minimap.ts` pins |

Guards: `engine-words` (no "quest giver" nouns in engine beyond today's "quest"), `no-url-switch`, HUD E332
coordination. Tests: extend `test/author-quest-data.test.ts`, `test/quest-story.test.ts`, `test/quest-step-runner.test.ts`,
`test/quest-flag-gates.test.ts`, `test/hud-pins.test.ts`; new `quest-giver-markers.test.ts` (four states from rows).
Host bar: extends a 5-user host; no new host.

## 3. Other shards in this slice

Every shard on the declared quest path keeps one quest at a time, untouched: the new fields are optional, a quest with
no `giver` behaves as today, the quest list shows the same single quest, and the HUD chip reads the same.

| Shard | Path today | Parity proof |
|---|---|---|
| Driftwood | `quests/quests` + `quests/host` | `test/driftwood-quest-content-product.test.ts`, `test/driftwood-quest-policy.test.ts`; the Wendell chain in game |
| Nalati | `quests/quests` + chapter view | `test/nalati-chapter-one.test.ts`, `test/quest-chapter-view.test.ts` |
| Sky, Signal | `quests` + `host` + `directors` | `test/quest-step-traces.test.ts`, their product tests |
| Pine | `quests/quests` + `custom/questRuntime` | `test/quest-step-pine-native-parity.test.ts`. The runtime itself is not touched here: its 29 KB (`out/pine-hollow/sections/custom/questRuntime.json`) opens with `content.board`, the lodge **contract board**, so M2.1/M2.2 move with the generic contract board (QC5) in the east's E1, where that host is built (Q5) |
| Templates | `data/quests.json` | `wildshard validate` |

Save risk: none for old saves (new flags only; a missing `acceptFlag` defaults to "accepted when startable", today's rule).

## 4. Done when, hours, blockers

**Done when:** in Developer the three givers show grey/yellow "!" per their rows; accepting a tier-1 quest adds it to
the QUESTS list; the tour quest (if Q1 a) plays end to end with its checkpoint cards and its "?" turn-in; every other
shard's quest chain plays unchanged (tests above + one look each at Driftwood and Signal).

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 16 h (Codex rows + Opus quest list/markers UI) | 6 h | 4 h | **26 h** |

**Blockers:** W1a. The HUD pieces wait on Jake's pick (Q3); the rows don't.

## 5. Risks

- The quest list and markers are shared HUD (E332): a notice to the HUD owners before, the SHA after.
- Pine's runtime keeps its own step machine until W1c; the new fields must not assume one path.

## 6. Questions for Jake

1. **A west tour quest.** Your rule is that the west toys need no quests. (a) no west quest: the givers' quests wait for
   E1; (b) one "Shift Orientation" tour: visit the five course boards, checkpoint cards, no reward. **Recommended (b):**
   it is the only way the quest path is playable and checked in the west, and it walks a new player past every toy.
2. **How many quests can be active.** (a) all 12 at once, one tracked on the HUD; (b) at most 3 (one per tier).
   **Recommended (a)** with one tracked: freeform is the point (decision 1), and the list costs nothing.
3. **Where the quest list lives.** (a) a list on the existing map tab above the quest card; (b) a new QUESTS tab in the
   pause menu. **Recommended (a):** no new tab, and the map is where you plan the next quest; a board of both goes to
   you before the UI lands.
4. **Grey "!" before levels exist.** (a) W1b ships the four states driven by flags, E0 adds the level atom; (b) wait for
   E0. **Recommended (a):** the states are the same; only their input changes.
5. **Pine's questRuntime (M2.1, the riskiest quest migration).** (a) in the west, beside W1b; (b) in E1 with the generic
   contract board, since most of it is Pine's lodge board. **Recommended (b):** W1b doesn't touch the runtime, and E1
   builds the host it moves onto; doing it now would build the board twice.
