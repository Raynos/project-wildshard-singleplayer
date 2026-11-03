# E14: every shard gets a shard-complete card (backfill first, then the validator rule)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the old **W17** ("backfill
`ui/completion` in every product, then a validator rule that requires it", Jake 11-02 decision 21), **M9.2** (one feats
row for Driftwood / Pine / Nalati, the parts the card's stats read) and **M9.3** (Pine's compendium icon picklist,
`format/compendiumRows.ts:21`, where the card's groups read it). KITCHEN-SINK §4 names it one of the four riskiest rows:
"red on every product until backfilled".

## 1. The showcase piece

The showcase's **shard-complete card** on the Titan gate's return pad after the victory (E12h): the title, kicker and
flavour, its stats (time played, kills, contracts, trophies, Gold, the Vault's best time), the credits row (MiniMax
Music 3, MOSS-SoundEffect v2, Stable Audio 3 Medium; audio plan §5), the `shardComplete` sting (E15b).

## 2. Engine / game / host work, just in time

Research:

- `src/format/completion.ts` (83 lines): `CompletionSchema { doneFlag, seenFlag, trigger: 'reward' | 'quest', system,
  before, after, title, card { kicker, flavour }, menuSubtitle, toastSuffix, safeRadius, pollSeconds, maximumTodo, more,
  coveredEvents, groups [{ id, todo: count | individual, label, spots }], stats [{ label, value: time | achievements |
  flags | group | title }] }`. Game: `src/game/complete/ShardComplete.ts`, `declared.ts`.
- **Only two products ship `ui/completion`**: Driftwood and `_template` (`out/*/sections/ui/completion.json`). Pine,
  Nalati, Nine, Sky, Signal, `blender-template`, `ink-cel-valley`, `pastel-plain` and the open plots don't.
- `trigger` is a closed `reward | quest` picklist; the showcase ends on a boss (`boss.attempt` `won`, `maps.ts`).

Work:

| Step | What | Layer |
|---|---|---|
| 1 trigger | `trigger: 'reward' \| 'quest' \| 'boss'` (+ `boss: <id>`) | format + game |
| 2 backfill | a card per product: Pine (the Antler King), Nalati (its last chapter), Sky (the Roc), Signal (the Matriarch), Nine (a prototype: its last director, or exempt: Q1), the templates (their hut-door quest / boss), each with groups and stats from its own flags and feats | each shard's generator (data only) |
| 3 rule | a shardfile validator rule: a product without `ui/completion` is refused, except the listed exemptions | format `shardSchema.ts` (the rules beside `:293`) |
| 4 docs | SHARDS.md "Your completion card"; the template's example already exists | docs |

Order inside the slice: 1 → 2 (one shard per commit) → 3 last, so nothing goes red.

Host bar: the card host has Driftwood and the template now, every shard after. Guards: `wildshard validate` runs the
rule; the custom-section freeze is unaffected. Tests: `test/` completion tests (grep `completion`), new
`completion-required.test.ts` (every product admits, a product without a card is refused, exemptions honoured).

## 3. Other shards in this slice

| Shard | Card | Proof | Save risk |
|---|---|---|---|
| Driftwood | exists | unchanged: its finale still ends on the card (`test/driftwood-finale-controller.test.ts`) | none |
| Pine, Nalati, Sky, Signal | new: shows after the final boss / chapter | the card fires once on its trigger in a headless run; one look each in game (Opus captures) | none (new `doneFlag` / `seenFlag`) |
| Nine, templates | new or exempt (Q1) | validate | none |
| Open plots | exempt (Q1) | validate | none |

## 4. Done when, hours, blockers

**Done when:** every shard product ships a card that fires on its trigger, the rule is on, the showcase's card plays
after the Titan with its stats and credits.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex) | 20 h (Codex rows; Opus 4 h for card captures) | 4 h | **32 h** |

**Blockers:** E12h (the showcase's trigger). Steps 1–2 (the trigger and the other shards' cards) need no east slice and
start in phase 1; step 3 (the rule) lands last.

## 5. Risks

- Writing a card's flavour text for five shipped shards is a taste call: the texts go to Jake in one batch as a list
  before they land (no board needed).

## 6. Questions for Jake

1. **Which products are exempt from the card rule.** (a) the open plots and Nine Dragon (a prototype fragment with no
   ending) are exempt, every shard and template needs one; (b) every product, open plots included.
   **Recommended (a):** an open plot is a hologram slot, not a shard with an end; Nine gets its card when it gets a
   story.
