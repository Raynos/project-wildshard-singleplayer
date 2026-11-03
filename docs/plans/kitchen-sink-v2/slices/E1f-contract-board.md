# E1f: the kill-contract board (a fixed, level-locked mode; Pine's lodge board migrated)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **QC5** (generic contract board
rows), **LE8** (fixed mode: a level-locked list, accept and claim, no draws; Pine keeps its draws), the contract part of
**LE7** (fixed rewards `{ first, repeat }`; `bolts` → grants), **M2.2** (Pine's board onto it) and **LW4** for band 1.

## 1. The showcase piece

The **contract board** on the town's gate plaza (W0b), next to the trophy wall's place: one row per robot type, elite
and the Titan, level-locked like quests (grey until its band's level). Band 1 now: "Scrap Patrol: down 20 Crate Mites"
(L1). First claim: 20 Scrip, a trophy id and the joke title *Pest Control*; repeats pay Scrip only. Grey kills don't
count. Later slices add their rows (E2–E6, E8, E12).

## 2. Engine / game / host work, just in time

Research (correcting W1b §3 and the migration map):

- **A contract board host already exists, Pine-shaped.** `src/format/contracts.ts` (302 lines): a catalogue with
  `draws` (weighted rotation, `:17`), `matches` (`species | rarity | elite | tag`, `:26`), `ranks`, `initial`,
  `fallback`, `elites`, `rows { id, kind, target, need, reward }` (`:33`); rewards carry Pine's `bolts` (`:10`, `:91`).
  `ContractBoardPageSchema` (`:62`) adds the panel, store, ammunition owner and finishes. Game:
  `src/game/quest/contractBoard.ts`, `contractBoardPage.ts`, `contracts.ts`; installed by `installContractBoardPage(ctx:
  ShardContext, …)` (`contractBoardPage.ts:36`) from the chapter host (`src/game/quest/chapter.ts:177`), i.e. on the
  plugin context. AS: Pine's `behaviour/contracts.as`, `contractsRandom.as`, `contractsRules.as` (the ninth decision
  module, `test/decision-module-cap.test.ts`).
- **Pine's board is only ~9 % of its custom runtime.** `out/pine-hollow/sections/custom/questRuntime.json` is 29 KB:
  `table` 11.4 KB (44 interactable rows), `content` 11.1 KB (of it `board` 2.5 KB, `npcs` 4.1, `chapters` 2.7,
  `trader` 1.8), `readings` 4.2, `lead` 2.3, `events` 0.9, `spawns` 0.6, `steps` 0.4. The board moves here; the rest is
  E1h / E1i.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| `quests/contracts` section | the catalogue + board page as a platform section (no longer inside `custom/questRuntime`) | format `contracts.ts`, `sections.ts` |
| fixed mode | `mode: 'fixed' \| 'draws'`; fixed lists every row, each with `requires: { level? , flags? }` (grey until met) | format + game `contractBoard.ts` |
| rewards | `reward: { first: [grants], repeat: [grants] }` with W2b's typed grants (`{ currency, n } \| { item, n } \| { ammo, n } \| { owned } \| { title } \| { finish }`); `bolts` read as `{ ammo: <the board's ammunition>, n }` on load | format + game (`quest/reward.ts`) |
| counting | a kill counts when it paid XP (not grey) and the contract is accepted; counts from `actor.died` through the match rows | game |
| off the plugin | `installContractBoardPage` takes the product and entered services, not `ShardContext` | game |

Host bar: two users (Pine draws, the showcase fixed): 6/6 after the move (no `bolts`, no context). Guards:
`host-callbacks`, `shard-names` (Pine's `pine.lodge` id stays data). Tests: existing contract tests (grep
`test/*contract*`), `test/quest-step-pine-native-parity.test.ts`; new `contract-fixed-mode.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Deleted | Parity proof | Save risk |
|---|---|---|---|---|---|
| Pine Hollow | `content.board` inside `custom/questRuntime`; draws; `bolts: 10` + a lodge ribbon | the board into `quests/contracts`, `mode: 'draws'`, bolts → an ammo grant | `content.board` from the custom section | seeded draw sequence identical for 10 rotations; a claimed contract gives 10 bolts + 1 ribbon; a look at the lodge board in game | **medium**: the board's saved progress (`store`) keeps its key and shape; fixture of a half-done contract |

## 4. Done when, hours, blockers

**Done when:** the plaza board lists the Mite contract (and greys future rows), 20 non-grey Mite kills complete it,
the first claim pays Scrip + trophy id + title, a repeat pays Scrip; Pine's lodge board draws, counts and pays as
before from its new section.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 16 h (Codex; Opus 4 h for the board panel's fixed view) | 10 h | 6 h (board model, rows) | **32 h** |

**Blockers:** E1c, E0d (grey kills), W1b (the plaza quest board's UI pieces), W2b (typed grants).

## 5. Risks

- Pine's contract AS (three modules) reads board state by its old shape; the section move must keep the AS inputs
  byte-identical or the draws change.

## 6. Questions for Jake

1. **Accept first, or count always?** (a) a contract counts only after you accept it at the board; (b) every row
   counts from your first kill, you just claim. **Recommended (b)** for the fixed board: no trip back to accept 16
   contracts; Pine's draws keep accepting.
2. **Titles.** (a) a title is worn from the Character tab (Progress already keeps a worn title); (b) shown only on the
   trophy wall. **Recommended (a):** the worn-title slot exists (`Progress.ts`), and joke titles are for wearing.
