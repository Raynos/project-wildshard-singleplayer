# WORLDCLAW-SHARD · the battery (a growing regression suite for the plan)

Each scenario is walked through:
- the plan (`docs/plans/WORLDCLAW-SHARD.md`);
- the flow (`docs/design/worldclaw/06-shard-flow.md`);
- the techniques (`04-our-pipeline.md`);
- the skills (`.claude/skills/worldclaw-visdev/SKILL.md`, `worldclaw-autonomous/SKILL.md`).

A scenario passes a round only when **every seat that walked it** passes it, and only when every step has an unambiguous answer: which row or step, which file / §, which command or
tool, what the executor does, and how it knows it's done. Scenarios are kept forever; a seat may **add** one that
covers something none does. A failing scenario names its register IDs.

| # | Scenario | Added | R1 | R2 | R3 | R4 |
|---|---|---|---|---|---|---|
| 1 | Guided run. Jake's vision: "a frozen fjord where you are the last ferryman" plus two reference games and a voice note. Walk P0 → P17: every file, command, board, gate and Jake touchpoint | R0 | FAIL (ABC) | FAIL (ABC) | FAIL (ABC) | FAIL (ABC) |
| 2 | Zero-shot run from "a desert canyon of wind-powered towns": what Jake sees, when, and who decides each front step | R0 | FAIL (ABC) | FAIL (ABC) | FAIL (ABC) | FAIL (ABC) |
| 3 | All three painted layout maps put the boss place in the wrong region | R0 | FAIL (ABC) | FAIL (A) | PASS | PASS |
| 4 | A composition puts a two-storey house on a 35° slope beside a route | R0 | FAIL (ABC) | FAIL (A) | PASS | PASS |
| 5 | TRELLIS and Hunyuan3D both return the landmark lighthouse with a hole in its base | R0 | PASS | PASS | PASS | PASS |
| 6 | The hub's pose costs 3.1 M triangles and 210 draws on the phone tier | R0 | FAIL (A) | FAIL (AC) | FAIL (C) | FAIL (C) |
| 7 | Codex quota runs out at the 40th of 80 references | R0 | FAIL (C) | FAIL (C) | PASS | PASS |
| 8 | Another agent's 45-min music batch holds the model lock when P11 starts | R0 | PASS | PASS | PASS | PASS |
| 9 | The pitch needs a 120 m sea cliff and a canyon floor 80 m down | R0 | FAIL (BC) | PASS | PASS | PASS |
| 10 | The judges split on a composition: J1 picks A at 7.5, J2 picks C at 8.0 | R0 | FAIL (BC) | PASS | PASS | PASS |
| 11 | The hub is a tavern the player must walk inside | R0 | FAIL (C) | FAIL (A) | PASS | PASS |
| 12 | After P12's pads, the walk test reports 3 stuck points on a graded route | R0 | FAIL (ABC) | FAIL (A) | PASS | PASS |
| 13 | Jake gets the final board and says "the look is wrong": redo the look without re-laying out or redoing content | R0 | FAIL (ABC) | FAIL (ABC) | FAIL (B) | PASS |
| 14 | At P6 Jake says "revise: move the boss arena to the north cliff": what is redone, what is kept | R0 | FAIL (AC) | FAIL (C) | PASS | PASS |
| 15 | X1 ends with "a mix: code trees, CC0 rocks, generated bushes": how the spec and P11 apply a mix | R0 | FAIL (BC) | FAIL (C) | PASS | PASS |
| 16 | A place marked `generated` needs a staircase into a building | R0 | FAIL (C) | FAIL (A) | PASS | PASS |
| 17 | N0 finds the normalized `style` union closed and `placement.size` 2D | R0 | FAIL (BC) | PASS | PASS | PASS |
| 18 | The judges approve a composition that hides a zipline anchor behind a house | R0 | FAIL (ABC) | PASS | PASS | PASS |
| 19 | Mid-build, the boss arena can't fit its 40 m clear ring on the approved terrain | R0 | FAIL (ABC) | FAIL (AC) | FAIL (BC) | FAIL (C) |
| 20 | Jake answers "no" to follow-along at P0, then asks for a time-lapse at the final board | R0 | FAIL (ABC) | FAIL (BC) | PASS | PASS |
| 21 | The pitch's new verb (a glider) needs 4 agent-days; Jake plays it at P7 and says "dull" | R0 | FAIL (BC) | FAIL (C) | PASS | PASS |
| 22 | Jake plays the slice at P9 and says no: "the first 5 minutes are empty" | R0 | FAIL (C) | PASS | PASS | PASS |
| 23 | Mid-build, Jake sends a note from the pool: "the lighthouse should be red" — and another: "move the hub to the beach" | R0 | FAIL (AC) | FAIL (ABC) | FAIL (C) | FAIL (ABC) |
| 24 | A generated model passes its 4-view review but fails the style check against the bible's anchors | R0 | FAIL (C) | FAIL (ABC) | PASS | PASS |
| 25 | A happening's signal (a smoke column) is hidden by terrain from the route it should pull the player along | R0 | FAIL (C) | PASS | PASS | FAIL (C) |
| 26 | The route-visibility mask says 80 % of the map is visible (an open plain): the detail budget saves nothing | R0 | FAIL (BC) | PASS | PASS | PASS |
| 27 | `design.md` says the hub has a trader; `spec.json` has no trader NPC | R0 | FAIL (ABC) | PASS | PASS | PASS |
| 28 | A director agent (the GW2 audit's director loop) is already working this shard and asks WorldClaw for only the grey world of one slice | R0 | FAIL (ABC) | FAIL (ABC) | FAIL (BC) | FAIL (BC) |
| 29 | After GAME-NORMALIZATION lands, this plan's first row N0 finds `EncounterService` has no hook for non-boss events (E7) | R0 | FAIL (ABC) | FAIL (B) | PASS | PASS |
| 30 | Jake's first walk produces 23 notes, 6 of them "doesn't sit right": what the run does with them and how the score is recorded | R0 | FAIL (ABC) | FAIL (A) | PASS | PASS |
| 31 | Guided run: Jake doesn't answer P3's board for 5 days: what proceeds, where the run's state lives, how a fresh session resumes | R1 (C) | FAIL | FAIL (BC) | FAIL (A) | FAIL (C) |
| 32 | The Simulator reads 1.4 GB at P14, then Jake's physical iPhone reads 2.3 GB at P16 | R1 (C) | FAIL | PASS | PASS | PASS |
| 33 | The picked pitch's traversal toy is a zipline (Driftwood shard code after normalization) | R1 (C) | FAIL | FAIL (C) | PASS | PASS |
| 34 | The pitch has a new enemy species and a new boss that P8 must play in grey before P9 | R1 (C) | FAIL | FAIL (BC) | PASS | PASS |
| 35 | At P12 the judges compare the built hub against a target that was painted over a Driftwood capture | R1 (C) | FAIL | PASS | PASS | PASS |
| 36 | By P12 the live page holds ~400 images + ~900 progress frames, and Jake types a note on it | R1 (C) | FAIL | FAIL (B) | PASS | PASS |
| 37 | After normalization, one baked mask cell and one building pad change without any TS import edit: prove the bake is stale and re-bakes | R1 (A) | FAIL | FAIL (AB) | PASS | PASS |
| 38 | J1 picks A at 6.0 and J2 picks C at 8.5; or one judge raises a style must-fix the other doesn't | R1 (A) | FAIL | PASS | PASS | PASS |
| 39 | A barrel placed on a bridge deck above the terrain, then on the upper of two floors at the same x, z | R1 (A) | FAIL | FAIL (AB) | PASS | PASS |
| 40 | An approved glider reaches a vista with no walking path, and reveals land from above | R1 (A) | FAIL | FAIL (AB) | FAIL (B) | PASS |
| 41 | P8: `physics-baseline --mode=walk` for the pilot has no route in the walk script's route file | R1 (B) | FAIL | PASS | PASS | PASS |
| 42 | P9 tonight: getting the grey slice onto Jake's phone (deploy, release URL, status, taps) | R1 (B) | FAIL | FAIL (B) | FAIL (B) | FAIL (ABC) |
| 43 | At P16 Jake's physical iPhone reads 1.3 GB in the World Explorer: what reopens | R1 (B) | FAIL | PASS | PASS | PASS |
| 44 | P11: the kit boar and the iron sword render in a shipped `kitLook` and fail the pilot's style check | R1 (B) | FAIL | PASS | PASS | PASS |
| 45 | A 3-week guided run spans ~20 sessions; at P16 the agent stitches the final time-lapse. Where are sessions 1–19's frames? (Per-session scratchpads, since purged) | R2 (C) | — | FAIL | PASS | PASS |
| 46 | The pitch has a new verb. At §5 step 7, P7's entry needs E8 done, but E8's done-when ("a fixture spec builds grey in ≤ 5 min; walk 0 stuck") needs T1 / T3 (step 5) and T4 / T5 (step 9), and no row owns a spec → … | R2 (C) | — | FAIL | PASS | PASS |
| 47 | Jake says "pitch me three shards for a drowned cathedral city". worldclaw-visdev is invoked directly; there is no `design.md`, ask or shard | R2 (C) | — | FAIL | PASS | PASS |
| 48 | Step 14: who opens P18's "fresh main session", how does the zero-shot skill stop after P5 (P18) or after P8 + T16 (P19), and do P18 and P19 share a sentence and a shard? | R2 (C) | — | FAIL | FAIL (ABC) | FAIL (BC) |
| 49 | At P12 Jake notes "everything is too saturated, pull the greens down". Which §10.3 row applies (re-look is "at P16 / P17"), and which passed assets are re-checked against bible v2? | R2 (C) | — | FAIL | FAIL (C) | PASS |
| 50 | Zero-shot: the judges' top pitch needs a custom weapon, two new species and a new boss (~+10 days). Is it allowed, and who weighs the cost? | R2 (C) | — | FAIL | PASS | PASS |
| 51 | On the deployed PWA, open a Model provenance image and a Set target whose sources live under art. No row maps these excluded source files to served assets/URLs, so local review success does not establish in-game … | R2 (A) | — | FAIL | PASS | PASS |
| 52 | J1 A=8/C=7, J2 A=7/C=8, J3 A=8/C=8. The specified median returns two equal winners; the executor has no bounded tie resolution. | R2 (A) | — | FAIL | PASS | PASS |
| 53 | The pilot is `status: 'hidden'` from P0 to P15. Which bakers run on it at P8 and P14 (navmesh, KTX2, packs), and are P14's GPU-MB and memory numbers what ships at P16? | R2 (B) | — | FAIL | PASS | PASS |
| 54 | P11 queues 48 isolated references through `run_codex.py --max-parallel 6`: how many codex runs start? | R2 (B) | — | FAIL | PASS | PASS |
| 55 | Jake says "pitch me three shards about a drowned bell city" (visdev invoked directly, no `design.md`, no ask) | R2 (B) | — | FAIL | PASS | PASS |
| 56 | A zero-shot run launched by `claude -p` stops on a codex quota at P11. The main agent relaunches "zero-shot <same sentence>" after the reset. Which branch runs, in which mode, and does it ask Jake anything? | R3 (C) | — | — | FAIL | FAIL (BC) |
| 57 | §5 step 2: T7's three fixture models must "pass every gate" with `provenance`, a field E3 adds at step 4 | R3 (C) | — | — | FAIL | PASS |
| 58 | P13: the boss model fails all five style rungs; rung 5 says "stays empty"; T16's final-look boss gate is hard | R3 (C) | — | — | FAIL | PASS |
| 59 | At P11 Jake notes "the wolves at the camp hit too hard, and the hub music is too loud" (no place, beat, look or single asset) | R3 (C) | — | — | FAIL | PASS |
| 60 | P0 run scope = world + one session slice. The slice ends at the hub; the boss lives on the far cliff. What does P8's T16 boss gate require? | R3 (C) | — | — | FAIL | PASS |
| 61 | After P8, Jake notes "add a keeper's hut on the north spit": its concept, mockup, P9b target and who approves them mid-build | R3 (C) | — | — | FAIL | FAIL (A) |
| 62 | at P4 Jake changes the palette, before the grey world/targets exist. The any-stage look row orders re-editing an old P9b target and running later model/budget stages without a conditional invalidation route. | R3 (A) | — | — | FAIL | PASS |
| 63 | P12 composes a close-band route turn between two places, at neither hero camera. Which target is its mandatory second input, who produces it, and what same-camera comparison closes the loop? Place-only P9b gives no … | R3 (A) | — | — | FAIL | FAIL (BC) |
| 64 | Step 3, "E10 → X1": E10's done-when needs the pilot's bakes, and the pilot only exists from P0 (step 6) and bakes at P8 (step 10). Can X1 start, and who creates `worldclaw-lab`? | R3 (B) | — | — | FAIL | PASS |
| 65 | X1's first push adds the hidden lab shard. Is it in the gpu-gate matrix, what poses and gate legs does its job run, and what happens to every agent's newest-green deploy if that job is red? | R3 (B) | — | — | FAIL | PASS |
| 66 | Zero-shot P8: reach fails for the secret after the walk / reach fallback. Who takes rung 3? Jake isn't asked in zero-shot, and the judges decide only after P9b | R3 (B) | — | — | FAIL | FAIL (ABC) |
| 67 | After P9b a critical-path place fails the slope gate, the edge-ramp repair fails, and Jake has sent no relocation note. Rung 2 says "move the place ≤ 20 m"; §10.3 says places move after P8 only by Jake's note, and a move would force a P9 replay | R4 (A) | — | — | — | FAIL (A) |
| 68 | Guided P8: after the pad ladder (edge ramp raised, place moved 20 m), the boss place is still 62 % under 30°. Who decides, and which §10.3 row does the 20 m move take? | R4 (C) | — | — | — | FAIL (C) |
| 69 | P11: the landmark lighthouse fails all five style rungs and takes the restyled sketch stand-in. At P12, T9 (hard) checks "sketch pieces replaced by final code models". Can P12 be marked done? | R4 (B) | — | — | — | FAIL (B) |
| 70 | P16 on the pilot `frozen-fjord`: the exact command for the physical-iPhone reading, and which shard's memory lands in Done-when 1's reading | R4 (BC) | — | — | — | FAIL (BC) |
| 71 | §5 step 7: P7's glider writes its leg test. Which interface (T5 comes at step 9, E9 at step 4), and what runs "the leg test runs headless"? | R4 (B) | — | — | — | FAIL (B) |
| 72 | X1 is done. At step 4, E9's fixtures run in the lab shard; at P3 a direction's route has no scatter-sources row (mini-X1). Where does each run, when is the lab shard deleted, and where does the mini-X1's pick go? | R4 (B) | — | — | — | FAIL (B) |
| 73 | P0 run scope = world + one session slice without the boss. At P17, Done-when 1 is rechecked: is the pilot done without a boss? | R4 (B) | — | — | — | FAIL (B) |
| 74 | P14: the hub stays at 2.4 M triangles after the seven levers and the judges' swaps; the final board lists the blocked branch. Does the pilot leave the gate exemption at P16, how is Jake asked, and what re-runs before his first walk? | R4 (C) | — | — | — | FAIL (C) |
| 75 | Jake types "zero-shot a desert of glass bells" in his own session (not P18 / P19); the session ends at P4 after ~6 h. Who starts the next session, and when does Jake next see anything? | R4 (C) | — | — | — | FAIL (C) |
| 76 | A Jake-invoked zero-shot shard reaches P16, and Jake says "make it experimental". Does it join the gpu-gate, and with which gate legs, poses and baseline? | R4 (C) | — | — | — | FAIL (C) |

## After the cap: the scoped check (round 4)

Four rounds is Jake's cap (D29), so there is no round 5. Codex re-walked every scenario that failed in round 4
(14 originals + the seats' 10 added) against the fixed docs ([round-4-check.md](round-4-check.md)): **20 / 25 passed**.
The 5 that failed (1, 2, 48, 56, and seat C's "Jake's own zero-shot run") all traced to three contradictions the
round-4 fixes introduced (R4-K1–K3). Those were fixed in `6ad92797`; they were not re-walked by a fresh seat.
