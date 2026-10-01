# E357 S2.5 — quest, starter effects and NPC rig proof

Builder: sol-s25, 2026-10-01. Source checkpoints: f3a65169, 00ef6376 + import correction 33c45412, 5ac8a99a, e6b0d938; final scoped row-button/count-timer cleanup accompanies this proof.

Pine now runs the engine QuestLine/QuestState, shared chip and NPC dialogue, scoped flags and actor death events, and emits quest.step. Authored chapters, contract templates, trades and NPC definitions remain shard data. The NPC leg/hull algorithm is in the kit, with Pine lantern profiles. Five starter rows bind movement and periodic damage through the combat pipeline; Debug applies the selected status every five seconds and active statuses mount SVG HUD icons. Blackpaw's legacy 1.3-second stun is effect.stun via S23's 8f3b7541, refresh=max(remaining, source duration). Effect timers update before encounter legs. There was no King stun to migrate.

## Focused verification

- 74 tests across seven files pass: frozen quest/board/trade/NPC measurements (60), source duration/ticks (2), starter damage/stack/slow/guard/disposal (7), authored beat flags/events (2), scoped Debug/HUD/dialogue/panels (3).
- Every authored harness beat resumes the same flags and step; completion emits the eight expected ordered transitions. NPC measurements preserve all three profiles at both tiers.
- Panel tests rerender board/trades and reset the count timer fifty times with unchanged Scope census, reject detached-button callbacks, and cannot reopen after disposal.
- Latest cleanup passes TypeScript in a clean e6b0d938 export with only the two owned cleanup files overlaid. The same 74 cases pass there and in the working tree after S23's transient species edits settle. Owned oxlint and whole ratchet pass; no allowances changed.
- Clean committed Vercel tree gate passes on final source daf74fa5386872d0086f28de1778c4af7335e066: CSS, generation/check, app/API TypeScript, oxlint, ratchet, vitest and production build. Final two-tier parity, milestone push and tuning board belong to the lead.

## Own before/after phone run

Before: 338c6a3ddb91de4a1edd353e97566ca572ace71e. After: 5ac8a99acf19ac0b4c2c94dc4217fdd65cfd76fc. All four shards, phone tier, walk+combat+leak. Both runners have exited and released their browser lane. Raw reports: /private/tmp/e357-s25/{before,after}/report.md. Compact observations: [s25-before-after.json](s25-before-after.json).

| Shard | Hit counts before / after | Boot / stuck / pause | Leak |
|---|---|---|---|
| Driftwood | sword 3 / 3 | no errors, stuck 0, pause diff empty | unchanged, scope all zero |
| Nalati | sabre 3 / 3; bow 2 / 2 | no errors, stuck 0, pause diff empty | unchanged, scope all zero |
| Nine Dragon | sword 1 / 1 | no errors, stuck 0, pause diff empty | unchanged, scope all zero |
| Pine | crossbow 3 / 3; lever 3 / 3 | no errors, stuck 0, pause diff empty | unchanged, scope all zero |

Kills, loot, combat event-sound counts and registry descriptors match on all four. Nalati's sampled ambient list additionally contains steppe.herd; its event sounds match. All GPU resources remaining after disposal are retained resources, with identical before/after retained counts.

Pine scene totals match exactly (676 mesh, 40 instanced, 20064 instances, 170 skinned); NPC and world registry entries match exactly. Physics colliders 2417→2409 and GPU textures 404→408 (+2800808 bytes); GPU buffers match. These resource differences are not accepted as parity. S2.1 continuation sol-s21b owns their investigation. The rig extraction adds no textures/colliders, and HUD icons are SVG/DOM. Nalati textures 128→125 are also an intervening shared-source change. Both global reports remain red against the stale recording; these conclusions compare the builder's own runs, as B27 requires.

The after capture precedes e6b0d938 and the final lifetime cleanup. Those later changes are contract-data and DOM-scope changes, verified by focused tests; final integrated capture remains the lead's milestone check. Five-effect tuning values remain proposed until the M2 creatures board is accepted; no tuning approval is claimed here.
