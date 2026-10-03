# The merge council · the register

One row per finding, every round; the ID never changes. Statuses: **fixed** (commit) · **rejected** (reason, evidence) ·
**settled** (re-argues the ledger without new evidence) · **parked** (a should-add not taken) · **escalated** (to Jake).

| ID | Round | Seat | Severity | Location | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| MC1 | 1 | ABC | must-fix | skill §0 dispatch, description; 06 §10.7 | No route into §X; the description barred it; no `existing` mode | fixed | dispatch step 1 = an existing shard → §X; description: §X usable now (D86); 06 §10.7 `mode: existing` |
| MC2 | 1 | ABC | must-fix | plan State, §5, R8, L rows | The L rows had no place in the order and the plan said nothing may run | fixed | §5 Now: L0 → L1 → L2 → L2b → L3 under D86; R8's exception |
| MC3 | 1 | B | must-fix | lint/shard-layout.json | `design/` failed the shard-layout guard | fixed | 7bffc07a6 (+ docs/SHARDS.md row, 219adb0c3 by E405) |
| MC4 | 1 | ABC | must-fix | plan §2b Frame / Form; skill BUILD, §X | An existing shard's checkpoint pointed at P9b targets and P11's catalog it never has; no ladder rule | fixed | existing-shard inputs (the plan's mockups, the registered models, mockup-to-model); the "from P9 on" ladder rows |
| MC5 | 1 | BC | must-fix | plan §2b Pin; L3 | A live shard's pin skipped the gpu-gate; L3 had no entry condition | fixed | Pin re-records the baseline (parity.mjs --rebaseline=<slug>, R33); L3 needs no T/E/W row |
| MC6 | 1 | ABC | must-fix | plan §2b vs auto skill :40 | auto: "the same gates" vs "no checkpoints per place" | fixed | auto runs the four gates internally, judges decide, no boards, golden-path next |
| MC7 | 1 | ABC | should-fix | plan §2b after-pin; skill step boundary | Drafts-site steps on an existing shard contradict §2c | fixed | drafts site for new shards only; §X skips the drafts steps |
| MC8 | 1 | BC | should-fix | plan §2b Pin | The pin named no command and no pass bar | fixed | bench-load.mjs, sim-memory.mjs (1.8 / 1.0 GB), budgetCeilings, the CI gates |
| MC9 | 1 | B | should-fix | D81 + D84, §6 | A live slice could go public on Simulator evidence alone | fixed | a slice changing rendering, batching or memory policy needs a physical reading (AGENTS.md) |
| MC10 | 1 | BC | should-fix | skill BUILD; 06 §5; plan §2b | Two place orders; next place worked before Jake's pick | fixed | places in golden-path order, bands inside a place; only pick-independent work before the pick |
| MC11 | 1 | C | should-fix | P12 | Route legs had no checkpoint | fixed | the leg into a place is part of its checkpoint |
| MC12 | 1 | BC | should-fix | P12 → P13 | P13 changed pinned places with no checkpoint | fixed | content on a pinned place re-runs its Play and Pin |
| MC13 | 1 | BC | should-fix | §2c item 2; skill §X; L2 | No capture recipe for the light front | fixed | scripts/worldclaw/capture-front.sh + spec-map.py (a plan map for a vertical shard), art/<slug>/round-<n>-light-front/ |
| MC14 | 1 | BC | should-fix | NINE-DRAGON-STACK State; §2c | Which slice is paused, how it resumes | fixed | §2c Pausing and resuming; NINE-DRAGON-STACK State names the paused rows (7bffc07a6) |
| MC15 | 1 | AB | should-fix | NINE-DRAGON-STACK §7 | Its method still described the old loop | fixed | a note: Nine Dragon grows by WORLDCLAW-SHARD's checkpoints |
| MC16 | 1 | B | should-fix | D80 vs skill §X / §S | D80 said the existing path is the single-stage entry | fixed | D80: §X the existing-shard path, §S a director's call |
| MC17 | 1 | C | should-fix | R15; L1 | R15 said YAML; L1 uses JSON; formats from a flat fjord | fixed | R15 amended (JSON, the schema file); the schema has heights (y) for a vertical shard |
| MC18 | 1 | B | should-fix | T1, L rows | D87's split not in the rows | fixed | T1 names L1 (formats) and L2b (checks); L2b row |
| MC19 | 1 | B | should-fix | 06 §10.2 | No stage-entry rows for the light front / an existing-shard checkpoint | fixed | two rows added |
| MC20 | 1 | B | should-fix | WORLDCLAW-TOOLS W12, J3 | One checkpoint board per place | fixed | W12: the four gates' boards, as many as needed |
| MC21 | 1 | B | should-fix | 06 §2 :52 | A P0 question nobody asks (build steering) | rejected | 06 :38 says the mode comes from the skill; the row records the mode's consequence, not a question |
| MC22 | 1 | BC | should-fix | skill §J, P5b, P7; R24; 06 §7 | E388 residue: ≥ 6, < 1, ≤ 10 sheets, ≤ 2 rounds, ≤ 10 min | fixed | removed or replaced by R6's pass / fail |
| MC23 | 1 | A | should-fix | plan §2b Play failure vs ladder | Incompatible continuation after an unresolved Play failure | fixed | a failed gate shrinks or polishes the place; past that, 06 §10.4's rows, then Jake |
| MC24 | 1 | C | should-fix | skill BUILD | "Start the next place's work before asking" while the next place is Jake's pick | fixed | start only pick-independent work |
