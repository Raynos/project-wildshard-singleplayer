# Round 4 · seat C (Claude, red-team execution of the round-3 fixes)

Read as the agent who must run §5's order, 06 §10's contracts and the two draft skills after normalization, walking the
seams round 3 opened: the dispatch order (single stage → zero-shot on an existing shard → resume → new run), the
judges' bounds from P9 (R16), R33's gate exemption with E10 and the lab shard, 06 §10.3 / §10.4 after their edits, and
the estimate. Scope: `git diff 1a9390cc..HEAD -- docs .claude` (5991eb01, 2685eb3d) plus the 66-scenario battery.
Line numbers are this tree's (`worldclaw` @ `2685eb3d`). "plan" = `docs/plans/WORLDCLAW-SHARD.md`, "06" =
`docs/design/worldclaw/06-shard-flow.md`, "04" = `04-our-pipeline.md`, "auto" / "visdev" = the two draft skills,
"03-gate" = `docs/plans/game-normalization/03-harness-gate.md`.

## Findings

| ID | Severity | Location | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R4-C1 | must-fix | R33; plan P16; auto P16, §Z; E10; R16 | **The exit from the gate exemption is unconditional, but P16 can arrive with hard gates still failing.** R16 and 06 §5 let a hard failure end as a blocked branch "waiting for Jake on the final board", and P16 lists "every blocked branch". Yet at P16 "the pilot leaves the gate exemption", with T6's gate poses and a first baseline. A blocked budget branch at the hub, or a blocked walk leg, then fails the per-push gate (the derived budgets are checked per pose, per push). Under newest-green that holds back every agent's deploy, the very thing R33 exists to prevent. <br>A Jake-invoked zero-shot shard has the opposite gap. §Z keeps it "hidden and gate-exempt until Jake's word". E10's flag holds only "while hidden", so Jake's `experimental` word puts it in the matrix with no gate legs, poses or baseline, because only "the pilot" gets those at P16 | plan:131 R33 "so a red grey build never blocks anyone's deploy … At P16 the pilot leaves the exemption"; plan:124 R16; 06:219–225; plan:291 P16 "every blocked branch … the pilot leaves the gate exemption"; auto:164, auto:184; plan:246 E10 "while hidden"; 03-gate:1135–1137 (budgets "checked: the per-push gate"), :1151 (newest-green), :320 (3 gate legs per shard) | R33 / P16 / auto: "A WorldClaw shard leaves the exemption only when its 3 gate legs and gate poses pass every hard gate (walk, budget, T16) and no blocked branch touches them. The pilot does it at P16. A zero-shot shard does it as the last step before Jake's `experimental` word, when T5 marks its gate legs and T6 its poses. An open blocked branch keeps the shard exempt and is shown on the board." From the exit on, AGENTS.md's baseline rule applies (03-gate §16); cost it in P16–P17 |
| R4-C2 | must-fix | plan P16; auto P16; 06 §7; Done-when 1; 04 §10 | **The physical-iPhone command can't read the pilot, and 06 §7 still gives the old method.** `scripts/iphone-mem-reading.sh` is hard-wired to Pine Hollow → Nalati. It takes only `--base` and `--fps` and exits 2 on any other flag. The plan and the skill say it "drive[s] a Safari tab at `?chunk=<slug>`", which is false. Only `webkit-mem-reading.mjs --url=` takes a shard. R3-B6's fix also missed 06 §7, which Done-when 1 and 04 §10 cite as "the method". 06 §7 still says "as `nine-dragon-mobile-multidraw.md` does it" and "Jake … opens the hidden pilot", but the script drives the tab, which must start on `/version.json` | `scripts/iphone-mem-reading.sh`:9 (usage), :20 (`*) echo "unknown $1" … exit 2`), :34–40 (`--url="$BASE/?chunk=nalati-grasslands"`); `scripts/webkit-mem-reading.mjs`:18 (`--url`); plan:291; auto:165–167; 06:286–290; plan:159 "(the method in 06 §7)" | P16, auto and 06 §7 give one method. Start the bridge as the .sh does, open `/version.json` on the phone, then run `node scripts/webkit-mem-reading.mjs --ws=<ws> --url=<base>/?chunk=<slug> --fps=150` (load, Explorer and world in one run). Or a tool row adds `--chunk <slug>` to the .sh. N0's list adds both scripts |
| R4-C3 | should-fix | 06 §10.4 fallback rows "slope", "sightlines" (new in round 3); 04 §5; R16 | **The new slope and sightline fallbacks end "else rung 4", which skips rung 3.** At P8 in guided mode, R16 and 04 §5 make Jake rung 3 ("reopen the layout (before P9: Jake)"). The rows instead send the failure to a blocked Handoff "for the final board". A failing P8 can't be done, though, so P9 and the board never come. From P9 on, they also skip the judges' allowed moves: move an object, such as the signal's emitter. And the rung-2 "move the place ≤ 20 m" at P8 matches no §10.3 row. "Before P8" redoes the mockups Jake approved. "After P8" says places move "only by Jake's note" | 06:435–436; 06:426–430 (the rungs in order); 04:113–116; plan:113 R5 "or reopen the layout"; plan:124 R16; 06:379–380 | Both rows end "else rung 3". 06 §10.3 gains one line: "A rung-2 move of ≤ 20 m at P8: `spec.json` + `design.md` (twin-check), the place's cam and T5's bands are redone. The mockups are kept, and the move is logged" |
| R4-C4 | should-fix | R16; 06 §10.4 rung 3; 06 §5; battery 66 | **A zero-shot hard failure before P9 still has no decider. R3-B4's part (a) wasn't applied.** R16 reads "Jake before P9 (guided); between P9 and P9b and after it, the judges". 06 §10.4's rung 3 still reads "after P9b" and lacks even the P9–P9b window. P19's done-when is "a P8-clean grey shard" in zero-shot, so its P8 reach, slope or walk failure lands in the gap | plan:124; 06:429; 06:224–225 "Before P9, Jake decides (guided); between P9 and P9b, the judges"; register R3-B4 Fix "zero-shot at every step"; plan:294 P19 | R16, 06 §5 and §10.4 rung 3: "guided before P9: Jake. Zero-shot before P9: the judges, who may also re-seat or move places inside their regions (logged; never cut a D25 must, a pillar, a beat or a happening). From P9, in both modes: the judges, inside the approved design" |
| R4-C5 | should-fix | auto BUILD "Notes" | **R3-C7's fix didn't reach the skill.** 06 §10.3 now says Jake's gate-reopening note "is itself the decision, so it is applied …, not asked back". The skill an agent executes still says "A gate-reopening note goes back to Jake as a decision while the run continues elsewhere". So "move the hub to the beach" gets asked back mid-build | auto:139; 06:389–391; plan:81 D36 | Replace the bullet: "A gate-reopening note is applied by its 06 §10.3 row (Jake's note is the decision); only an ambiguous note gets one clarifying question" |
| R4-C6 | should-fix | auto P9 step 1 | **R33's "no baseline while exempt" didn't reach the skill.** It still says "Record the gate baseline when look, layout or content changed". 06 §4.2 says "While the pilot is gate-exempt (R33) its commits record no gate baseline", and an exempt shard has no `record` job. The skill's step also drops "or a newer one that contains it" | auto:116–117; 06:187–188; plan:130 R22; 03-gate:800–806 (record jobs per matrix shard) | "… → check `version.json` shows the SHA or a newer one containing it. While gate-exempt, no baseline (R33)" |
| R4-C7 | should-fix | plan P9b (what + done-when); auto P9b; 04 §8 step 1; 06 §10.6 | **R3-A6's route-leg targets landed only in 06 §4.3 and T5.** The plan's P9b captures "every place's planned camera", and its done-when checks only "every place has a target". The skill's P9b also captures only "every place's camera". P12 then composes every route leg "with the P9b target as the second input" (plan, 06 §5, auto, 04 §8.2), and a skill-driven run has no such target. 04 §8 step 1 frames only `cams/<place>.json`. 06 §10.6's P9b count doesn't include the leg targets | plan:284; auto:124–125; 06:195–199; plan:287; auto:153; 04:155–159; 06:465 | Plan P9b and auto P9b add "and T5's route-leg cameras (`cams/leg-<id>.json`), re-edited to the bible with the nearest place's mockup". P9b's done-when: "every place and close-band route leg has a target". 04 §8.1: "the place's or leg's camera". Add the leg targets to §10.6's count |
| R4-C8 | should-fix | 06 §8 "Launching"; auto §0 step 2, §Z; plan P18 / P19 / R18 | **The relaunch loop can't run unattended.** <br>(a) The launcher relaunches `"resume <slug>"`, but the child picks the slug (step 4), and nothing hands it back. P19's "zero-shot … until P8" must "name a shard", but the grammar "zero-shot <sentence> [until P<n>]" has no slug slot. <br>(b) A codex-quota exit isn't a stop condition, so the launcher relaunches at once, the child stops at once (`waitingOn: codex-quota`), and this repeats until the reset: a busy loop of fresh sessions. <br>(c) "a Handoff stops it" can't be tested, because a Handoff is written at every commit. No bound covers a child that exits again and again without progress. <br>(d) A zero-shot run Jake starts himself (D51's real use) has no launcher, since §8 scopes it to P18 / P19. A whole shard spans many sessions, so Jake would have to type "resume", against "Jake sees only the final board" | 06:310–313; auto:27–28, :36–43, :185–187; 06:494–495 (quota "stops"); plan:96 D51; AGENTS.md "No `until …; do sleep …; done` loops longer than 4 min" | Grammar: "zero-shot <sentence> [until P<n>]" for a new run, "zero-shot <slug> until P<n>" on an existing one. The child writes its slug into its ask file and prints it first. §run gets `stop: done \| blocked \| quota(<reset>)`. The launcher stops on `done` or `blocked`; on `quota` it starts one background `sleep` to the reset, then relaunches; after 2 relaunches at the same `step` it stops and reports. Every zero-shot invocation's receiving main session is the launcher |
| R4-C9 | should-fix | 06 §10.7; auto §0 step 3; R23; battery 31 | **The 48-h re-send still isn't recorded (R3-C1's fourth bullet).** §run gained `mode`, `until` and the answers, but no record of a re-send. "Re-send once; a second 48 h → stop" therefore has no anchor across sessions. At 120 h a session can't tell whether to re-send or stop, and every session that starts between 48 and 96 h re-sends | 06:475–491; auto:31–33; plan:132 R23; round-3-seat-C R3-C1 Fix (`resentAt`) | §run gets `resentAt`. Re-send when it is absent and `waitingOn` is older than 48 h; stop with a Handoff when `resentAt` is older than 48 h |
| R4-C10 | should-fix | plan T1; 06 §10.2 single stage; auto §S; battery 28 | **The single stage calls a mode that no tool row builds.** `spec-check --scope slice` appears only in 06 §10.2 and auto §S. T1's row and its done-when have no slice scope, while T17 got its content-only mode and a fixture. twin-check has no rule for a director's design with no ` ```yaml worldclaw ` block, yet R15 runs it "after every steer" | plan:252 T1; 06:359; auto:192–194; plan:268 T17 (content-only + fixture); plan:123 R15 | T1 adds `--scope slice`: the role, count and entry-road rules are off; ids, heights, legs and happening signals stay on. It gets a fixture. twin-check is skipped (logged) on a single stage whose design has no machine block |
| R4-C11 | should-fix | R16; 06 §5; plan P13–P16; 06 §10.3 "after P8" row; battery 6, 19 | **A blocked branch has no path after the final board.** <br>• P13 ("T16 … in the final look"), P14 ("every pose within the gate") and P15 ("no must-fix") can't be done while a branch is blocked, yet R16 means the run to reach P16. No rule says such a stage counts as done-with-blocked-branches for entry. <br>• At P16, nothing says how the branch is asked or whether Jake's answer is applied before or after the P17 walk. Nothing says which stages re-run either: the after-P8 row's redo stops at T16 and placements, with no P14, P15 or new board, while the after-P9b look row lists them | plan:124; 06:221–223; plan:288–291; 06:380 vs 06:385 | "A stage whose only failures are blocked branches is `done (blocked: <ids>)`, and the run goes on. At P16 each branch is one question with the recommended answer and its cost. The answer is applied by its §10.3 row, then P14–P15 re-run on the touched places and poses and the changed board panels are re-sent, all before P17" |
| R4-C12 | should-fix | R33; R30; E10; E9; 06 §3.3 step 2 | **The lab shard's lifetime is unstated.** R33 says the lab shard is "deleted after use", and R30 / E10 tie its use to X1 (step 3). E9's done-when (step 4) tests "in the lab shard", though, and P3's mini-X1 names no shard at all. No row deletes it, so an executor either deletes it after X1 and breaks E9, or keeps it forever. The same holds for P18's shard ("deleted after use", while P19 continues it) | plan:131, :139, :230, :244, :246; 06:91–93 | R33: "The lab shard serves X1, E9 and P3's mini-X1, and is deleted in S1. P18's shard is deleted after P19." The mini-X1 runs in the lab shard |
| R4-C13 | nit | visdev §0 "Check the needs" | P2–P3's needs omit E3, which R3-A1's fix added to 06 §10.2 | visdev:27; 06:349 | "P2–P3 need E3, T7, T10–T12, T14 and X1" |
| R4-C14 | nit | E359; plan R23, R18 | Old summaries remain: E359 cites "R1–R32"; R23's §run list lacks `mode`, `until`, the answers and the hold; R18 has `claude -p` without the permission mode or relaunch | E359.md:111; plan:132; plan:126 | "R1–R33"; R23 and R18 point to 06 §10.7 and §8 |
| R4-C15 | nit | 06 §10.3 "look changes after P9b" and "added or cut" rows | The after-P9b look row covers P10–P17, but at P10–P12 its chain names outputs that don't exist yet ("P13 models' post → card art", "a new board"). It lacks the before-P9b row's "later stages simply use v2". An added place's "concept (P4)" doesn't say who approves it mid-build | 06:385, :384, :381 | "… redo only what exists; later stages use v2"; "its concept (P4, judged)" |
| R4-C16 | nit | plan E3 | E3 now comes before T7, but its card still shows "the two phone copies … made by T7" (R3-C2's second half) | plan:238; plan:318 | "the fixture's copies are hand-made; T7 makes them for emitted models" |

## Battery

| # | PASS/FAIL | Why (the step that has no unambiguous answer) | Finding IDs |
|---|---|---|---|
| 1 | FAIL | P8's slope or sightline failure skips rung 3; the skill asks Jake back on gate-reopening notes and records a baseline while exempt; P9b makes no leg targets for P12; P16 leaves the exemption with blocked branches and runs a reading script that reads Nalati | C3, C5, C6, C7, C1, C2, C11 |
| 2 | FAIL | The front's deciders are clear (the judges, P2–P6), but a Jake-invoked zero-shot run has no launcher across sessions, and a P8 hard failure has no rung-3 decider | C8, C4 |
| 3 | PASS | T3: all three fail → stamp the discs, logged | — |
| 4 | PASS | R5 object pad ≤ 1.5 m, else move along the ray; T9 | — |
| 5 | PASS | The other engine, then a code model (style rungs 3–4) | — |
| 6 | FAIL | Levers → the judges (swap, re-dress) → a blocked branch. The branch's P14 can't be "done", its path after the board is unstated, and P16 then exits the exemption with an over-budget pose | C11, C1 |
| 7 | PASS | Guided: `waitingOn: codex-quota` + the reset; the next session resumes (zero-shot under `claude -p`: 56) | (C8) |
| 8 | PASS | `run-locked.sh` queues; the main agent waits in the background | — |
| 9 | PASS | E1 extent → `heightRange`; T4 ramps; pads | — |
| 10 | PASS | R6: J3 when the top option's split is ≥ 1; median | — |
| 11 | PASS | R26 code whole | — |
| 12 | PASS | Walk fallback → the judges after P9b → rung 4 | — |
| 13 | PASS | The after-P9b look row through P16; "the look is wrong" is ambiguous, so it gets one clarifying question | (C15) |
| 14 | PASS | "Moves before P8": maps + twins + the mockups that see it | — |
| 15 | PASS | scatter-sources.json kind × route | — |
| 16 | PASS | Stairs are code; an entered building is code whole | — |
| 17 | PASS | E1, E6 | — |
| 18 | PASS | T9 cones (hard); T9 fallback: trim, move, swap | — |
| 19 | FAIL | It ends in an allowed move or a blocked branch (never an ask or a cut). After the board, how the arena move is applied and what re-runs before P17 is unstated | C11 |
| 20 | PASS | Recording always on, in the durable folder | — |
| 21 | PASS | P7 "dull" → P2's verb line; twice → cut; verdict log | — |
| 22 | PASS | "A beat or the slice changes" + P9 replay; Jake decides while back before P9 | — |
| 23 | FAIL | The red lighthouse is clear (one-asset row). "Move the hub": 06 applies the note, but the skill sends it back to Jake | C5 |
| 24 | PASS | Dressing not placed; a required slot gets the stand-in | — |
| 25 | FAIL | At P8 a terrain-hidden smoke column hits the sightlines row: raise ≤ 20 %, "else rung 4", which skips Jake (rung 3 before P9). After P9 it skips the judges' "move an object" | C3 |
| 26 | PASS | R11 bands | — |
| 27 | PASS | twin-check ids and values | — |
| 28 | FAIL | `spec-check --scope slice` isn't in T1, and twin-check has nothing to compare on the director's design | C10 |
| 29 | PASS | E7 engine mechanism | — |
| 30 | PASS | Sizing, freeze, S / M ≤ 2 rounds; after the exit, AGENTS.md's baseline rule applies (§3 rule 1) | — |
| 31 | FAIL | §run holds the wait, and the hold works. But a session at 120 h can't tell whether the board was already re-sent, so it can't choose between re-send and stop | C9 |
| 32 | PASS | 2.3 GB → reopen P14 | — |
| 33 | PASS | E9: existing verb | — |
| 34 | PASS | E8a stand-ins; T16 real strikes | — |
| 35 | PASS | P9b on the pilot's grey world | — |
| 36 | PASS | R20 `db` + `assets` | — |
| 37 | PASS | Output-byte freshness | — |
| 38 | PASS | J3; an evidenced must-fix blocks | — |
| 39 | PASS | T8 support binding | — |
| 40 | PASS | Typed glide leg with P7's leg test; bands on the glide eye path | — |
| 41 | PASS | T5 writes walk legs; zero → error | — |
| 42 | FAIL | Deploy and taps are clear, but the skill's P9 records a gate baseline that 06 §4.2 forbids while exempt | C6 |
| 43 | PASS | 1.3 > 1.0 GB → reopen P14 | — |
| 44 | PASS | E6; P11 style check | — |
| 45 | PASS | `~/.cache/wildshard-worldclaw/<slug>/frames/` | — |
| 46 | PASS | P7 needs E8a + E9 only | — |
| 47 | PASS | visdev §0 → auto §0 step 4 + P0 → back | — |
| 48 | FAIL | Who launches and how P18 stops are clear. But the launcher can't learn P18's slug for "resume <slug>", P19's invocation has no slug grammar, and a quota exit busy-loops | C8 |
| 49 | PASS | Palette = taste → the after-P9b look row; re-posted and restyled assets re-take the style check | (C15) |
| 50 | PASS | Zero-shot caps | — |
| 51 | PASS | Phone copies | — |
| 52 | PASS | Tie order | — |
| 53 | PASS | E10 bakes while hidden | — |
| 54 | PASS | 6 live; per-job timeout | — |
| 55 | PASS | As 47 | — |
| 56 | FAIL | §8 now says to relaunch "resume <slug>" (mode kept), but the launcher has only the sentence, not the slug. Relaunching "zero-shot <same sentence>" hits step 4 and a slug clash. Waiting for the reset isn't in the loop | C8 |
| 57 | PASS | E3 → T7 at step 2 | (C16) |
| 58 | PASS | A required slot → restyled stand-in, a logged gap | — |
| 59 | PASS | The catch-all note row | — |
| 60 | PASS | Boss out of the slice → logged as out of scope | — |
| 61 | PASS | Added place: concept + judged mockup + P9b target (who approves the concept: nit) | (C15) |
| 62 | PASS | The before-P9b look row: bible v2 edit; the made concepts re-edited | — |
| 63 | FAIL | 06 §4.3 makes route-leg targets, but the plan's P9b and the skill's P9b don't. The skill-driven run reaches P12 with no leg target | C7 |
| 64 | PASS | E10 creates `worldclaw-lab` before X1 | (C12) |
| 65 | PASS | `gateExempt` → no gate job, so no red | — |
| 66 | FAIL | Rung 3 before P9 is "Jake (guided)" only; 06 §10.4 still says "after P9b" | C4 |
| 67 | FAIL | **(new)** Guided P8: after the pad ladder (edge ramp raised, place moved 20 m), the boss place is still 62 % under 30°. 06 §10.4 says "else rung 4" (a blocked branch for a final board that can't come); R16 and 04 §5 say Jake reopens the layout. Which §10.3 row does the 20 m move take? | C3 |
| 68 | FAIL | **(new)** P14: the hub stays at 2.4 M triangles after the seven levers and the judges' swaps; the final board lists the blocked branch. Does the pilot leave the gate exemption at P16, how is Jake asked, and what re-runs before his first walk? | C1, C11 |
| 69 | FAIL | **(new)** Jake types "zero-shot a desert of glass bells" in his own session (not P18 / P19); the session ends at P4 after ~6 h. Who starts the next session, and when does Jake next see anything? | C8 |
| 70 | FAIL | **(new)** P16 on the pilot `frozen-fjord`: the exact command for the physical-iPhone reading | C2 |
| 71 | FAIL | **(new)** A Jake-invoked zero-shot shard reaches P16, and Jake says "make it experimental". Does it join the gpu-gate, and with which gate legs, poses and baseline? | C1 |

## Verdict

2 must-fix / 10 should-fix / 4 nit (16); battery 53 / 66 PASS (5 scenarios added, 67–71, all FAIL: 53 / 71).
