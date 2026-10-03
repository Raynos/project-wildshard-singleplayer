# The merge council · the register

One row per finding, every round; the ID never changes. Statuses: **fixed** (commit) · **rejected** (reason, evidence) ·
**settled** (re-argues the ledger without new evidence) · **parked** (a should-add not taken) · **escalated** (to Jake).

| ID | Round | Seat | Severity | Location | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| MC1 | 1 | ABC | must-fix | skill §0 dispatch, description; 06 §10.7 | No route into §X; the description barred it; no `existing` mode | moot | dispatch step 1 = an existing shard → §X; description: §X usable now (D86); 06 §10.7 `mode: existing`; then withdrawn with the existing-shard path (D89, D90) |
| MC2 | 1 | ABC | must-fix | plan State, §5, R8, L rows | The L rows had no place in the order and the plan said nothing may run | moot | §5 Now: L0 → L1 → L2 → L2b → L3 under D86; R8's exception; then withdrawn with the existing-shard path (D89, D90) |
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
| MC13 | 1 | BC | should-fix | §2c item 2; skill §X; L2 | No capture recipe for the light front | moot | scripts/worldclaw/capture-front.sh + spec-map.py (a plan map for a vertical shard), art/<slug>/round-<n>-light-front/; then withdrawn with the existing-shard path (D89, D90) |
| MC14 | 1 | BC | should-fix | NINE-DRAGON-STACK State; §2c | Which slice is paused, how it resumes | moot | §2c Pausing and resuming; NINE-DRAGON-STACK State names the paused rows (7bffc07a6); then withdrawn with the existing-shard path (D89, D90) |
| MC15 | 1 | AB | should-fix | NINE-DRAGON-STACK §7 | Its method still described the old loop | moot | a note: Nine Dragon grows by WORLDCLAW-SHARD's checkpoints; then withdrawn with the existing-shard path (D89, D90) |
| MC16 | 1 | B | should-fix | D80 vs skill §X / §S | D80 said the existing path is the single-stage entry | fixed | D80: §X the existing-shard path, §S a director's call |
| MC17 | 1 | C | should-fix | R15; L1 | R15 said YAML; L1 uses JSON; formats from a flat fjord | fixed | R15 amended (JSON, the schema file); the schema has heights (y) for a vertical shard |
| MC18 | 1 | B | should-fix | T1, L rows | D87's split not in the rows | fixed | T1 names L1 (formats) and L2b (checks); L2b row |
| MC19 | 1 | B | should-fix | 06 §10.2 | No stage-entry rows for the light front / an existing-shard checkpoint | fixed | two rows added |
| MC20 | 1 | B | should-fix | WORLDCLAW-TOOLS W12, J3 | One checkpoint board per place | fixed | W12: the four gates' boards, as many as needed |
| MC21 | 1 | B | should-fix | 06 §2 :52 | A P0 question nobody asks (build steering) | rejected | 06 :38 says the mode comes from the skill; the row records the mode's consequence, not a question |
| MC22 | 1 | BC | should-fix | skill §J, P5b, P7; R24; 06 §7 | E388 residue: ≥ 6, < 1, ≤ 10 sheets, ≤ 2 rounds, ≤ 10 min | fixed | removed or replaced by R6's pass / fail |
| MC23 | 1 | A | should-fix | plan §2b Play failure vs ladder | Incompatible continuation after an unresolved Play failure | fixed | a failed gate shrinks or polishes the place; past that, 06 §10.4's rows, then Jake |
| MC24 | 1 | C | should-fix | skill BUILD | "Start the next place's work before asking" while the next place is Jake's pick | fixed | start only pick-independent work |
| MC25 | 2 | BC | must-fix | plan §2b Pin | The re-record command fails (`--export` missing) and R33 re-records per commit, not per pin | fixed | Pin cites R33's recipe after the exemption; no command in the plan |
| MC26 | 2 | BC | must-fix | skill §0 dispatch (MC1) | Existing-shard rule ran before §S: a director's one-stage call became a light front | moot | the existing-shard rule is gone (D90); §S is rule 1 again |
| MC27 | 2 | BC | must-fix | plan State, L rows | State said `draft` and the L rows `todo` while L1 and L2 had landed | fixed | State names L0 in flight and L1 done; L2 / L3 dropped (D89) |
| MC28 | 2 | BC | should-fix | design template §run; skill resume | §run lacked 06 §10.7's fields | fixed | the template's §run lists them |
| MC29 | 2 | C | should-fix | Pin (bench-load) | bench-load measures no frame time; the deploy pin is newest-ci-green | fixed | Pin: T10's census and the phone tier's frame rate at the place's cameras; bench-load for load time; 'the next deploy ships it' |
| MC30 | 2 | C | should-fix | §2b auto | Auto's Play gate needs video, which the judges never watch (R6) | fixed | auto's judges read Play's capture as a frame strip with the walk legs |
| MC31 | 2 | B | should-fix | WORLDCLAW-TOOLS §3, W12 | MC20 landed in the catalogue table (7 cells, the days lost); W12 unchanged | fixed | the catalogue row restored (~0.5), W12 itself updated |
| MC32 | 2 | BC | should-fix | plan P5b, P15, P17; 06 §6 | MC22 left ≤ 2 rounds and ≤ 10 sheets | fixed | removed |
| MC33 | 2 | C | should-fix | spec.ts legs | Route legs are XZ only: a lift leg has no length | parked | the first vertical new shard adds per-point heights; Thin Ice is flat (D90 took Nine Dragon out) |
| MC34 | 2 | BC | should-fix | Nine Dragon (paused list, design files, capture recipe) | Several Nine Dragon findings | moot | Jake: Nine Dragon is not a WorldClaw shard (D89); its plan's State restored; design files removed |
| MC35 | 3 | ABC | must-fix | plan S1 | S1 still has the skill absorb the existing-shard light front | fixed | S1: the checkpoint chapter; new shards only, D90 |
| MC36 | 3 | BC | must-fix | skill §S; 06 §9, §10.2; T1 `--scope slice`; T17 content-only; spec.ts `slice` | §S runs on a shard without `spec.json` and keeps its terrain: only a shipped shard fits, against D89 / D90 | closed (Jake) | Jake picked "Any shard" (not the recommendation): D91, §S on any shard, the exception to D90; the plan, the skill's description, rule 1 and §S say so |
| MC37 | 3 | C | must-fix | skill P8 | 'every place ≥ 80 % under 30°' is invented (E388); the plan reports the gentle-ground share | fixed | the plan's words |
| MC38 | 3 | ABC | should-fix | §2b Pin; T10 | Nothing measures the Pin's frame rate | fixed | T10 adds the frame time per pose (the parity pose sampler), reported, not gated; Pin names T10, sim-memory and bench-load with their flags |
| MC39 | 3 | ABC | should-fix | plan P12, P17; 06 §5, §6; 04 §8; skill P17 | MC32's caps left in four places; the skill's P17 sentence broken | fixed | removed everywhere (a must-fix that stays climbs §10.4's ladder); sentence repaired |
| MC40 | 3 | BC | should-fix | §2b Pin; auto | The Pin's physical-iPhone reading came from the live-shard path; it stalls zero-shot | fixed | the shard's reading is P16's; an engine change for the live shards is the engine lead's, with its own reading |
| MC41 | 3 | B | should-fix | §2b; skill BUILD | A blocked branch inside a checkpoint had no rule | fixed | pins as `pinned (blocked: <id>)`, deploys hidden, the next place opens; P16's question (R16) |
| MC42 | 3 | BC | should-fix | §2b content after a pin; skill | New models after a pin skipped Form; a shard-wide pass unclear | fixed | Form for new or changed models, then Play and Pin; a shard-wide pass re-pins nothing, P14 / P15 check it once |
| MC43 | 3 | BC | should-fix | template §run | Missing the pending board / question and queued commands; `step` vs `run.stage` | fixed | both lines added; `step` is the machine block's `run.stage`, one value |
| MC44 | 3 | BC | should-fix | both dispatches; 06 §2, §8 | 'Existing shard' meant two things; nothing refused a shipped slug | fixed | 'a zero-shot run'; a new run or a new bound on a shipped slug stops (D90) |
| MC45 | 3 | BC | should-fix | mockup-to-model description | Routed a shard slice to a skill that refuses it | fixed | a new shard's place → the checkpoint; a shipped shard's slice → its own plan |
| MC46 | 3 | BC | nit | helpers, skill :180, template, auto skill, README, T1 | Leftover §2c / L2 / D84 / slice citations; MC30 not in the auto skill; T1 lists L1's work | fixed | all reworded |
