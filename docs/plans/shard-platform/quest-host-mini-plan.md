# Shared quest host: finish it in parallel (G564, G565)

Jake, 2026-10-21 ~11:25 Cancun: *"Split this up into multiple lanes. And try and fix this whole … I just want to fix."*
Phase B (G532 (1)) ran on one lane (sp-x8) from 10-20 22:39. Measured at HEAD `089644c2a6` by the plan agent's subagent
(`sourceProgressInventory()` in the check slot): **Pine C5 586, Driftwood C5 227** (the ruler's 753 for Pine predates
`ad7457afc3`, which made the quest-page binder shared). **No paperwork in any row** (G564): no receipt folders, no
parity/proof docs; land on types, lint, focused tests and the push gate, numbers in the commit message.

## What is left

| Pine (586) | lines | Driftwood (227) | lines |
|---|---|---|---|
| `sdk/quest/forestStory.ts` (Pine-only) | 193 | `game/quest/nativeProps.ts#NativeQuestProps` (+2) | 105 |
| `game/quest/nativeStory.ts` (Pine-only) | 182 | `quest/install.ts` | 84 |
| `game/quest/chapterDirector.ts` `installChapterLead` + `installQuestSpawnDirector` | 103 | `runtime/models/people.ts`, `trader.ts` | 31 |
| `game/quest/nativeStoryRows.ts`, `sdk/quest/forestStoryRows.ts` | 69 | `QuestPresentation` (G520 charge), `hybrid.ts` | 7 |
| `game/quest/steps.ts` spawn exports | 20 | | |
| `pine-hollow/quest/views.ts` | 18 | | |

Only 18 of Pine's lines are in the shard; 568 are platform code only Pine uses (charged, G520). Driftwood is 116 shard + 111 charged.

## Rows (disjoint files; one lane each)

| Row | What | Owns | Saves | Effort |
|---|---|---|---|---|
| **QA** (critical path) | **Pine client on the shared page composition:** Pine's page rows through `installQuestPageComposition` (runs on `prepareQuestEntry` like `forestStory`), optional row facets for board, interaction pages, mover, collections, map zones; Pine becomes the real second user (also clears Driftwood's 6 charged lines). Lantern lights + hollow projection stay listed view (~30). Delete `forestStory*` | `sdk/quest/forestStory*`, `pine-hollow/quest/views.ts`, `game/quest/pageComposition.ts`, `format/questPageComposition.ts` | ~243 | ~1 day |
| **QB** | **Pine headless on the approved native composition** (G474): Pine onto `installNativeQuestComposition` with rows; delete `nativeStory*`. Old saves: the `questSaved` envelope (lead, cable, pack, board, trader, ammunition) decodes byte-for-byte, one focused test | `game/quest/nativeStory*`, `nativeComposition.ts`, `nativeEntry.ts`, `nativeInputs.ts`, `format/nativeQuestComposition.ts` | ~219 | 6–8 h |
| **QC** | **Pine lead and spawns into Pine AS + data:** stare/trot/gone decisions and spawn conditions; per-frame pose + puffs stay listed view (~25); call signatures unchanged so QA's call sites hold | `game/quest/chapterDirector.ts`, `game/quest/steps.ts` | ~123 | 4–6 h |
| **QD** | **Driftwood flag gates onto a shared gate host** with Pine's mill-door bar collider as the second user (QA switches the door by rows). Barrels (~65) wait on Jake's G517 pick | `game/quest/nativeProps.ts`, `game/plugin/quests.ts` | ~35 (+65 with the pick) | ~2 h |
| **QE** | **Driftwood outer setup as rows:** speaker/trader placement as entry rows (G2a's catalogue rows exist), place-set members and keepsakes as declared rows, imports shrink; bridge sway (22) and people/trader rigs (31) stay listed view | `driftwood-isle/quest/install.ts`, `runtime/models/people.ts`, `trader.ts`, `hybrid.ts` | ~60 | 4–6 h |
| **QX** | **Integrator + acceptance** (sp-x8): owns the shared files the others send changes for (`docs/ENGINE.md`, package export maps, `scripts/generation-jobs.json`, both shards' `headlessAssembly.json`, `generators/output.ts`, `namedSchemas.ts`); X5 acceptance: both shards play their quests and old saves load | the shared files | — | with the others |

QC, QD and QE run in parallel with QA from now; QB alongside QA (separate files). QX lands the shared-file edits in
order and closes X5.

**Floors:** Pine about 55 listed view lines; Driftwood about 120 (barrels 65, bridge 22, figures 31), about 55 if Jake
allows AS body operations (G517). Strict zero for both when WASM-HOST's 60 Hz AS lands (G532 (5)).
