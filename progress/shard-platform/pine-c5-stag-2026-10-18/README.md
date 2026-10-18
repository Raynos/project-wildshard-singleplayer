The stag walk moves from its whole TS module into Pine's existing life
AssemblyScript guest. The page still owns actor integration, motion,
appearance and sound; the native adapter retains the original i/mode/t
save fields. The existing quest step, chapter and director hosts retain
flag/reward/notice and clock ownership.

This is a leaf deletion. C5 remains open: quest/index.ts combines entered
page resources and modal/view wiring; runtime/quest.ts binds native prompts,
modal arbitration, inventory and save continuation; stagLead.ts draws the
moving apparition; nightThralls.ts presents the AS-owned encounter.
featLaw.ts stays because its attempted direct-host replacement raises the
native callback guard. No allowance changes are included.

The reused ReturnProgram host scores 6/6 against docs/HOST-BAR.md:

1. Two users: src/shards/pine-hollow/quest/stagLead.ts:30 and
   src/shards/driftwood-isle/species/monkeyBinding.ts:68.
2. No shard nouns: src/game/population/returnProgram.ts:18.
3. Data driven: src/game/population/returnProgram.ts:27.
4. Server safe native entry: src/game/population/returnProgram.ts:75.
5. Survives Pine deletion: src/shards/driftwood-isle/species/monkeyBinding.ts:68.
6. Numeric observations/results, no callback hook:
   src/game/population/returnProgram.ts:80.

No host API changes. Net platform source lines: 0.

Cadence call: this uses stateless projections at the existing page/fixed
step, bending SCRIPT-ABI v1's <=10 Hz decision cadence. Retaining exact
phase ordering avoids quantizing the original walk. Production requests
retain ReturnProgram.ts:86's 400000 fuel cap. measurements.json records
both desktop Chromium and iOS Simulator Safari, selecting the highest
fuel case among the measured states, as warm batch means in
ms/frame (20 batches of 2000 frames after warmup); page figures include
two projections per frame. It is a projection microbenchmark, not a
physical-phone frame-rate or memory claim.

Map-input source-only window: official rebake belongs to sp-x10. Inputs
changed by this cut: behaviour/life.as, generators/bake-life.mjs,
generators/questRuntime.ts and generators/sections.ts. No look changes.

Historical pre-G499 result: Pine 3,962 -> 3,934 (-28), C5 784 -> 756.
Pine AS 465 -> 488 / 2,130 (+23). DW 3,146 custom / 130 AS is unchanged
by this cut. Platform source delta 0; generators +5 (reported outside
custom). Direct TS units reconcile -49 deleted +10 view adapter +11
native/save adapter = -28. The ~150-line aim was not reached by this leaf.

Gates passed on source tree d3199bb2ef33297b8585e9564f4d03baedd37e6f:
root/layer types, typed lint, all ten source products, 44 focused tests
(including all 17 headless cases), two old-save envelopes, strict DW
workerExact 1000 and Pine continuation 1200. Stale-map warnings are the
explicit source-only G490 window; the batch owner owns the official bake.
A muted iPhone 16 Pro progression/reload check follows on the exact
landed commit and is reported over Herdr.

Candidate phone rehearsal passed on d3199bb2e, muted iPhone 16 Pro:
stag flags survive reload; all seven bends set followed:stag and advance
to king; king and its prior quest flags survive a second reload.
Browser and preview were closed. The landed-SHA check still follows.
The phone driver uses the existing quest debug jump and public stag
update method at the seven authored bends; it checks real quest effect
commits and reload persistence, rather than claiming a manual playthrough.

Final combined-source verification: e062b0a309828fcd6c3dd363a5becd19e4e3dab1
(parent ba4e6d2a6605dc8f1f5238168b26cf27a071bc33).
The latest G499 source ruler is Pine 4,128 -> 4,100 (-28), DW 3,276
unchanged; Pine AS 488, DW AS 130. C5 is now 792 -> 764 (-28). The G499 policy
charges +166 Pine and +130 DW independently of this leaf. All required
gates, including both native replays, passed again under proof
20261018T075735-sp-x9-c5-latest-gates-38592.

G503 correction (2026-10-18): the historical cadence steer above is
superseded. The page now makes one lead projection per >=100 ms and lets
Animal integrate its motion every drawn frame. The native adapter projects
once per six saved 60 Hz host ticks, advancing only its existing elapsed
clock between decisions. The original i/mode/t envelope remains unchanged;
no new save field, AS, host API, map input or look change is required.
Cancellation remains silent; appear/fade/complete each run once per edge.
Page fixtures cover 30/60/120 Hz and native fixtures cover 60 fixed ticks,
old-save envelopes and all four original stag modes. Existing strict native
continuations cover actor/RNG/save ordering. This is the explicitly ordered
G503 correction before the next C5 whole-module removal.
