# Round 3 · seat B (Claude: coverage + a code-grounded audit of the round-2 fixes)

Reviewed: `git diff c9550cc0..HEAD -- docs .claude` (17e176ac, 1a9390cc), the 61 R2 register rows, battery 1–55. Each
R2 row's old wording was grepped across the plan, 06, 04, 03, 05, the README, both skills, both outlines and E359. Each
new claim was checked against this tree and `docs/plans/game-normalization/`.

**Verified true (no finding):**
- The register holds 119 + 61 = 180 rows; R2 is 11 / 44 / 6. The battery's R2 column has 16 PASS.
- The estimate lines add up to ~31–40 (base "~30–40"). The pass mark is ≥ 6 in R6, 06 §6 and auto §J. Picks go to J3
  at a gap of ≥ 1, gate lines at ≥ 3. The caps (≤ 4 per board, ≤ 6 codex, ≤ 3 rounds a place, ≤ 2 loops) are the same
  in every doc.
- `worldclaw-proto` @0825a9f5 has `{fjord-spec.json, schematic.py, mkjobs_layout.py, terrain_vis.py, place_solve.py}`.
  @268e87f2 has the iso re-draw and the Hunyuan yurt. @0cc81155 has `out/fixture-layout-{a,b,c}-512.png`, the band
  maps, and `c-slab-stats.json` (bands 37.5 / 34.3 / 20.5 / 7.7, so T5's "within 2 points" can be checked).
- The spec has each of these as cited:
  - `showHiddenShards` (02-foundations:1309, under Debug ▸ Developer tools);
  - the hidden-shard baker filter (02:1310–1311);
  - newest-green deploys and the per-commit baseline rule after Z4 (03-harness-gate:1151–1155);
  - the fake `Game` and `sim-no-render` (02 §F5, 01:919);
  - engine `'quests'` in the closed `Mechanism` list (01:354–355);
  - every T16 / T6 param on `lint/url-params.json` `harness`, `chunk` included.
- `docs/audits/nine-dragon-mobile-multidraw.md` and `physical-shard-memory-baseline-2026-09-28.json` exist (the method is
  in a script; see B6).
- These fixes landed: the 04 rewrite; R3 / T8 support binding; R5 split into place and object pads; the R6 pass mark and
  ties; the R12 stage order; the R16 / 06 §10.4 style ladder ending in "not placed"; the R19 frames folder; the R20
  `db` + `assets` capabilities; R22's gpu-gate; the E7 fake Game; E8a + T17 (no deadlock left for P7); T16's real
  strikes; T5's mode partition; the look row and the place-move rows in 06 §10.3; the single-stage files column; the
  outlines; E359's Status; the dead anchor.

## Findings

| ID | Severity | Location | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R3-B1 | must-fix | Plan E10 done-when; §5 step 3; 06 §10.2 P8 row; R30 / X1 | **E10 can't be marked done before P8, so the order deadlocks again, as R2-C1 did for E8.** E10's done-when needs the pilot's bakes. The pilot is created at P0 (step 6) and baked at P8 (step 10). Yet step 3 runs "E10 → X1", P2–P3 need X1, and P8's own entry lists E10. Also, **no row creates `worldclaw-lab`**: E10 (step 3, before X1) and E9 (step 4) both test in it, but R30 and X1 only say X1 "runs in" it | plan:245 "the lab shard and the pilot get their bakes while hidden"; plan:318 "3. E10 → X1"; 06:335 P2–P3 needs X1; 06:338 P8 needs E10; plan:281 P8 "bakes via E10". A grep for `worldclaw-lab` / "lab shard" hits only R30, X1, E9, E10 and §5, and none of them creates it | E10's done-when becomes: "a fixture hidden shard with the flag gets navmesh / KTX2 / packs, one without it gets none; the shipped bakes byte-identical". E10's first step: create `src/shards/worldclaw-lab/` from the template (Z1), `status: 'hidden'`, `bakeWhileHidden: true`. P8's done-when gains "the pilot's navmesh, KTX2 and packs exist" |
| R3-B2 | must-fix | auto §0 dispatch; 06 §10.7 §run; 06 §8 / §10.2 P19; R18 | **A zero-shot run that resumes forgets that it is zero-shot and where it stops. That breaks P19.** Dispatch checks resume (step 2) before zero-shot (step 3). §run records no mode and no `until`. P19 is "zero-shot … until P8" on P18's shard, whose `design.md` exists. So the session resumes and "continue[s] at `next`" with no bound: it runs past P8, and at P9 it follows guided rules and asks Jake. The same happens to any zero-shot run that spans sessions (R23). P18 / P19 must run "from the skills alone" | auto:26–32 (order; step 2 "otherwise continue at `next`"); 06:453–459 (§run = step, waitingOn, next, SHA, page URL, frames, board, queued commands); 06:295–296 "P19 continues P18's shard 'until P8'"; 06:344 P19 reads "P18's design.md" | §run gains `mode` (guided / zero-shot) and `until`. Dispatch step 2 applies the invocation's mode and `until P<n>` to the resumed run (the invocation's `until` wins), and a zero-shot resume never asks Jake. P19's invocation: "zero-shot resume <slug> until P8" |
| R3-B3 | should-fix | auto §0 step 3 + §Z; visdev §0 | **Zero-shot has no creation path, and visdev's fallback loops back into it.** The ask claim, slug, template shard (`hidden`, `bakeWhileHidden`) and `design.md` steps sit under step 4, "a new guided run". Step 3 jumps to §Z, which has none of them. Visdev §0 says to run autonomous §0 + P0 when `design.md` is missing, and §0 sends a zero-shot invocation straight back to §Z. P18's clean-room session meets this first | auto:32–38; auto:164–172 (§Z: no create step); visdev:23–24 | Make the four create bullets a shared step, run by both 3 and 4. In zero-shot it asks nothing, claims the ask from the sentence, and writes §run's `mode: zero-shot` and `until` (B2) |
| R3-B4 | should-fix | R16; 06 §10.4 rung 3; 06 §5; 06 §10.3 "after P8" row; auto BUILD | **Rung 3 has no decider in two windows, and a judges' decision can reopen a gate mid-build.** (a) Rung 3 is "Jake before P9 (guided); after P9b the judges". A zero-shot hard failure at P8 (P19's "P8-clean" target) has no decider, and neither does a guided hard failure during P9 / P9b. (b) If the judges resolve a failure by moving a critical-path place (battery 19's boss arena), the after-P8 row says "Jake replays P9". That is a mid-build ask, against "Never ask him mid-build" (D15) | plan:124; 06:410; 06:211–213; 06:366 "on the critical path → Jake replays P9"; auto:132–133 | Rung 3: "guided through P9: Jake; zero-shot at every step, and guided from P9b on: the judges". The judges may not move, add or cut a place or change the slice. Such a failure goes to rung 4 and the live page, and Jake answers by note |
| R3-B5 | should-fix | 06 §10.4 hard list + fallback table vs 06 §4.1, 04 §5, plan P8 | **Three of P8's hard gates are missing from the gates-and-ladders contract:** every place ≥ 80 % under 30°, sightlines, and T9's play checks (clear zones, signals, traversal views). The executor can't tell whether they are hard, and they have no fallback (battery 19, 25) | 06:169–176 (§4.1 Hard: "every place ≥ 80 % under 30°", "sightlines", "T9's play checks"); 04:121–126; 06:392–400 and :413–420 (neither lists them) | Add the three to the hard list. Fallbacks: slope uses R5's place-pad ladder (raise `edgeRamp`, move ≤ 20 m, reopen the layout); sightlines move the blocking dressing, then the viewpoint; T9 moves, raises or cuts the failing object |
| R3-B6 | should-fix | 06 §7; plan P16 / Done-when 1; auto P16 | **The physical-iPhone method cites an incident record, not the method.** `nine-dragon-mobile-multidraw.md` gives results and no commands. The repo's method is `scripts/webkit-mem-reading.mjs`, with `scripts/iphone-mem-reading.sh` as the recipe (E263 / E302): a pymobiledevice3 Web Inspector bridge driving **a Safari tab** that loads `?chunk=<slug>`. So "Jake … opens the hidden pilot" (the PWA taps) is the wrong set-up. He opens `/version.json` in Safari with Web Inspector on and Low Power off | 06:274–278; auto:153–155; iphone-mem-reading.sh:4–7, :22–30; webkit-mem-reading.mjs:1–20, :39; nalati-load-memory-2026-09-29.md §"The method" | 06 §7 / P16: "USB, unlocked, Safari ▸ Advanced ▸ Web Inspector on, Low Power off, a Safari tab on `/version.json`. Run `node scripts/webkit-mem-reading.mjs --ws=<bridge page> --url=<prod>/?chunk=<slug>` (the iphone-mem-reading.sh recipe) and record it like the 09-28 baseline JSON" |
| R3-B7 | should-fix | R22; N0; E10 / X1; T5; §5 estimate | **The pilot, the lab shard and P18's shard join the gpu-gate matrix from their first commit, and the plan doesn't plan for it.** `matrix.mjs` lists every `src/shards/*/manifest.ts`, and Z3 says "its gate job and baselines appear by themselves". Four things follow: <br>• Each shard needs gate poses and 3 `"gate": true` legs, and T5 marks none. <br>• A red pilot or lab job stops the newest-green deploy for every agent. <br>• The matrix goes from 5 to 8 jobs, beyond the 5 macOS jobs that run at once, so the gate takes longer for every push. <br>• Every look / layout / content commit needs a baseline record (≤ 45 min). <br>R2-B4's fix text asked N0 to check this, and N0 doesn't | 03-harness-gate:800–806, :311 (poses in `scripts/parity/poses.mjs`), :320 (gate legs), :637–639, :1146–1155; 11-finish:87–88; 02-foundations:422; plan:217 (N0's list); round-2-seat-B R2-B4 Fix | N0 checks each WorldClaw shard's gate duties. T5 / T17 emit the pilot's poses and 3 gate legs. R22: commit and push the pilot at step boundaries, with one baseline record per push. X1 says the lab shard enters the gate, and how long it lives. The estimate counts the gate time |
| R3-B8 | should-fix | 06 §8 "Launching"; R18; P18 / P19 | **`claude -p "<invocation>"` can't run a zero-shot front unattended as written.** It names no permission mode, so tool calls that would prompt are not approved (no host in a bare CLI). A print-mode run also exits when the agent ends its turn, and nothing says how to continue a multi-hour front afterwards | `claude --help`: "-p, --print  Print response and exit"; "--permission-mode <mode>"; "--permission-prompts … 'none' (… anything that would prompt is denied automatically)"; "--bg, --background"; 06:298–299 | Give the full command: `claude -p --permission-mode <the mode agents run here> "/worldclaw-autonomous zero-shot <sentence> until P5"` under `run_in_background` (or `claude --bg`). When it exits before `until`, the main agent relaunches "zero-shot resume <slug> until P<n>" (B2) |
| R3-B9 | should-fix | T15 done-when (R2-C23) | **T15's dry run writes a note "from a phone-sized agent-browser session", but the live page is a private claude.ai Artifact** whose `db` writes come from the signed-in viewer. A headless agent-browser session isn't signed in to claude.ai, and the row doesn't say how it would be | plan:265; Artifact contract ("hosted on claude.ai … private by default"); `~/.agent-browser/config.json` holds only `headed` / `idleTimeout` (no profile) | Name the sign-in: an agent-browser auth profile that Jake saves once, at F1 / T15 time. Or make the dry run an ArtifactData `set` in the page's `notes` shape, plus one phone note from Jake at P0 |
| R3-B10 | should-fix | 06 §10.2 single-stage row; auto §S; T17; battery 28 | **A single-stage P8 on a director's existing shard has no rule for that shard's terrain.** T17 builds the whole world from `spec.json` (T4 over every region). The single-stage row says to "run its producer for the slice or region only", which gives a spec for one region. T17 then either overwrites the director's terrain or has no terrain outside that region | 06:345; plan:267 "T4 terrain, T3 region weights, …"; plan:254 "`layoutLandscape(spec, regions)`" | Single-stage P8 on a shard whose terrain isn't from `spec.json` keeps that terrain. T17 runs content-only there (stand-ins, content rows, legs on the existing ground). Region-only terrain is for WorldClaw shards |
| R3-B11 | should-fix | Plan §2, the line under the flow | **R2-A9 / R2-B6's own evidence line is unchanged.** The plan still says zero-shot judges "P7 / P9", against R18, 06 §8 and both skills ("no P7"). R2-B6 cited this line and is stamped fixed | plan:187 "the judges take P2–P6 and judge P7 / P9"; plan:126 R18 "so no P7" | "the judges take P2–P6 (no P7: existing verbs only) and judge P8–P9" |
| R3-B12 | should-fix | T5; P7; 06 §10.4 "every non-walk leg's test"; battery 40 | **No row writes a new verb's leg test, and that test is a hard gate.** T5 gives non-walk legs "their verb's mechanical test (the kit zipline from E9; others when their verb exists)". P7 builds a new verb such as a glider, but neither P7 nor the new-verb add says it delivers a test that T5 can run. The glide leg then fails the hard gate, or the executor makes up a test | plan:255; plan:277; 06:393 | P7's done-when adds "the verb's leg test in T5's format: launch → landing within the target's radius → a clear exit, run headless". The pitch's "+ N days" covers it |
| R3-B13 | should-fix | 06 §10.3 "The look changes" row; battery 13 | **The re-look chain measures budgets before the new look and never re-delivers.** It runs "… → P14 budgets → P10 → P12 compares", so the LOOK-LOOP (programs, post) runs after the budget pass. It also stops before P15 and P16, yet bible v2 changes textures (GPU MB) and so the physical reading behind Done-when 1 | 06:370; plan:150–158 (Done-when 1 needs the reading); T10 counts programs and GPU MB (plan:260) | "… → P10 → P12 compares → P14 → P15 → P16 (a new board and a new physical reading)" |
| R3-B14 | nit | 03:113, :125; README:11, :31; 05:54; plan:301 (S3); sketch:19, :49; E359:111 | Old wording left over from R2-B2 / R2-C1. `worldclaw/<slug>/mask.png` is a path in neither tree (03's header says "every path below exists"). "Happenings are a new data row on the encounter runtime" contradicts R12's engine mechanism. "Level brief" survives in the README and 05. "E8" is now E8a. E359 lists "E1–E10 (+ E8a …)" | as cited | 03: region weights as world data (06 §10.1), and "an engine mechanism (R12)"; "level brief" → `design.md`; E8 → E8a; E359 → "E1–E7, E8a, E9, E9b, E10" |
| R3-B15 | nit | Plan T7, T14, E10 | Three tool rows carry only part of their R2 fix. <br>• T7's row lacks the phone copies that E3, 06 §10.1 and auto P11 assign to it (R2-A11). <br>• T14's done-when (2 finals, "≤ 6 live") never tests the cap, and unknown flags still pass silently (R2-B3 asked for 8 jobs, never more than 6 at once, and exit 2). <br>• E10 leaves out `unused-assets`, one of R2-B4's four playable-only bakers, without saying why | plan:257; plan:264; plan:245; 06:322; 02-foundations:1310–1311 | T7: "+ phone copies (≤ 200 KB, 06 §10.1)". T14's done-when: "8 jobs → never > 6 live; an unknown flag exits 2". E10: name `unused-assets` (it takes the flag, or why not) |
| R3-B16 | nit | Plan §5; R22 / 06 §4.2 taps | Numbers and taps. "About twelve touchpoints" lists 13 (P7 is conditional). The "E1–E9" estimate line leaves out E10. The taps drop the "Developer tools" group. Under newest-green, `version.json` may show a newer commit that contains the SHA | plan:352; plan:336; 02-foundations:1309; 03-harness-gate:1151 | "twelve, thirteen with P7"; "E1–E10"; "Settings ▸ Debug ▸ Developer tools ▸ `showHiddenShards`"; "shows the SHA or a newer one that contains it" |

## Battery

| # | PASS/FAIL | Why (the step that has no unambiguous answer) | Finding IDs |
|---|---|---|---|
| 1 | FAIL | Step 3 can't finish E10 (done-when needs the pilot), so X1 and P2 never start; nobody creates the lab shard. P8 has hard gates outside §10.4. P9's deploy depends on gate jobs the pilot can't pass yet (poses, gate legs). P16's reading cites no runnable method | B1, B5, B7, B6 |
| 2 | FAIL | Zero-shot has no create step (§Z), and visdev's fallback loops. A P8 hard failure in zero-shot has no rung-3 decider. Plan §2 still says P7 is judged. A second session forgets mode / until | B3, B4, B11, B2 |
| 3 | PASS | T3: all three fail → stamp the discs over the best variant, logged; 06 §10.4's fallback; visdev P5 says the same | — |
| 4 | PASS | R5: a 35° footprint needs more than 1.5 m of cut / fill, so the object moves along its ray to the nearest ≤ 15° spot, off the route corridor; T9 checks | — |
| 5 | PASS | 04 §15 / the style ladder: the other engine, then a kit or code model; a climbed lighthouse is code anyway (D19) | — |
| 6 | PASS | Budget is hard. Its fallback is 04 §10's levers in order (≤ 4 rounds). Then the judges decide (P14 comes after P9b), posted as "decided for you". Then a blocked Handoff | — |
| 7 | PASS | 06 §10.7: write `waitingOn: codex-quota` and the reset time, then stop. Dispatch step 2 doesn't resume before the reset. Qwen never ships a reference | — |
| 8 | PASS | `run-locked.sh` queues the batch; the main agent waits in the background | — |
| 9 | PASS | E1 `extent` → `heightRange`; T4's edge ramps; P8 pads; the 80 % slope gate | — |
| 10 | PASS | R6: the highest J1 + J2 mean wins when the judges are < 1 apart on it; otherwise J3 joins and the median decides | — |
| 11 | PASS | R26: code, whole; 04 §15 now agrees | — |
| 12 | PASS | Pads stay off route corridors (R5). The walk / reach fallback re-grades or benches the leg, then moves the dressing; then the ladder | — |
| 13 | FAIL | The look row is complete up to P12, but it measures budgets before the new LOOK-LOOP and never reruns P15 or P16's board and physical reading | B13 |
| 14 | PASS | 06 §10.3, a move before P8: P5 maps + twins, then the mockups of every camera that sees the place; other places, the bible and concepts kept | — |
| 15 | PASS | `scatter-sources.json` maps kind × route; spec-check enforces it; P11 builds from it | — |
| 16 | PASS | Stairs are code (D19); the building is code if anyone walks into it (R26) | — |
| 17 | PASS | E1 adds a separate `extent` field; E6 opens `kitLook`; N0 logs both | — |
| 18 | PASS | T9's traversal approach views and clear cones run after dressing (R25) | — |
| 19 | FAIL | Clear rings are T9, which 06 §10.4 neither lists as hard nor gives a fallback. The judges' rung-3 answer (move the arena) is a critical-path move, which makes Jake replay P9 mid-build | B5, B4 |
| 20 | PASS | R19: the frames are always shot into the durable folder; a late time-lapse is made from them, labelled with what it covers | — |
| 21 | PASS | P7 runs after P3, once E8a and E9 are done. "Dull" goes back to P2 (places and bible kept); a second "dull" cuts the verb. Days come from the per-pitch adds. (B1 still blocks reaching P2) | — |
| 22 | PASS | 06 §10.3 "a beat or the slice changes": redo design.md, the spec, the P8 rows and T16, then replay P9 | — |
| 23 | PASS | The red lighthouse is a one-asset note, so it gets a bible exception line. Moving the hub reopens a gate, so it goes to Jake; on yes the after-P8 row runs, with a P9 replay | — |
| 24 | PASS | The style ladder's rungs 1–3, then (4) a kit or code model, then (5) not placed, logged | — |
| 25 | PASS | E7's `seenFrom`; T9 casts the rays; rung 1 moves or raises the signal | (B5) |
| 26 | PASS | R11 bands by distance, not by visible / not visible | — |
| 27 | PASS | twin-check compares ids and values; `design.md` owns intent, so the trader goes into the spec | — |
| 28 | FAIL | Running a missing file's producer "for the slice or region only" gives a region-only spec, and T17 then builds terrain over the director's existing shard; no rule says whether it keeps that terrain | B10 |
| 29 | PASS | R12 / E7: a happenings engine mechanism; fights go to `EncounterService.spawn` / `elite` | — |
| 30 | PASS | R32: sized L / S / M (first match wins) with a reason; the ids + SHA freeze; S / M fixed in ≤ 2 rounds; the rest stay asks | — |
| 31 | PASS | 06 §10.7: post the board and end the turn (`needs pick`); §run holds the state; each session's start re-sends after 48 h, then stops after a further 48 h | — |
| 32 | PASS | P14 is only a pre-check. The 2.3 GB physical reading reopens P14 and blocks Done-when 1 | (B6) |
| 33 | PASS | E9 already puts the zipline in the kit, so it is an existing verb: no P7 | — |
| 34 | PASS | E8a's grey stand-ins (rig clip names); P8's grey rows with phases; T16 beats the boss with real strikes | — |
| 35 | PASS | P9b re-edits a capture of the pilot's grey world | — |
| 36 | PASS | R20: `db` + `assets`, paginated per stage; notes read at each step boundary | (B9) |
| 37 | PASS | T3 / 04 §4: freshness by comparing the bake's output bytes | — |
| 38 | PASS | R6: J3 on the split; an evidenced must-fix blocks until fixed or disproved | — |
| 39 | PASS | T8: the `on` support; several floors or no hit → flagged | — |
| 40 | FAIL | The glide leg needs "its verb's mechanical test", and no row writes one, while every non-walk leg's test is a hard gate | B12 |
| 41 | PASS | T5 writes the walk legs; an empty set is an error | — |
| 42 | FAIL | Deploy now waits on gpu-gate, and the hidden pilot's own job needs poses, 3 gate legs and a bootstrap baseline, which nothing provides. A red pilot job stops everyone's newest-green deploy | B7, (B16) |
| 43 | PASS | 1.3 GB is over the 1.0 GB Explorer cap, so P14 reopens | — |
| 44 | PASS | E6 opens `kitLook`; P10 applies the kit look; P11's style check covers kit pieces | — |
| 45 | PASS | R19 / T13: the durable frames folder; T13's two-session dry run | — |
| 46 | PASS | E8a has no later dependency (T17 is separate), so P7 can start at step 7 | — |
| 47 | PASS | Visdev §0: no `design.md` → autonomous §0 (guided step 4 claims the ask and creates the shard) + P0, then back to P1 | — |
| 48 | FAIL | P19 "until P8" on P18's shard takes the resume branch, which doesn't know zero-shot or `until`. `claude -p` has no permission mode and no relaunch | B2, B8 |
| 49 | PASS | The look row covers a palette note "at any stage"; it reopens a gate, so it goes to Jake; everything is re-checked against bible v2 | — |
| 50 | PASS | R18's caps (a kit weapon, ≤ 1 new species, a stand-in boss, ≤ +3 days) rule that pitch out | — |
| 51 | PASS | 06 §10.1 phone copies under `public/assets/explore/<slug>/`, read by E3 / E4 | (B15) |
| 52 | PASS | A and C split by 1, so J3 joins; the medians tie at 8, so the tie-breaks apply: first line, then cost, then id | — |
| 53 | PASS | E10: navmesh, KTX2 and packs bake for a hidden shard that opts in, so P14 measures what ships | (B1, B15) |
| 54 | PASS | T14 adds `--max-parallel`, so 6 start | (B15) |
| 55 | PASS | Same as 47 | — |
| 56 | FAIL | **(new)** Step 3, "E10 → X1": E10's done-when needs the pilot's bakes, and the pilot only exists from P0 (step 6) and bakes at P8 (step 10). Can X1 start, and who creates `worldclaw-lab`? | B1 |
| 57 | FAIL | **(new)** X1's first push adds the hidden lab shard. Is it in the gpu-gate matrix, what poses and gate legs does its job run, and what happens to every agent's newest-green deploy if that job is red? | B7 |
| 58 | FAIL | **(new)** Zero-shot P8: reach fails for the secret after the walk / reach fallback. Who takes rung 3? Jake isn't asked in zero-shot, and the judges decide only after P9b | B4 |

## Verdict

2 must / 11 should / 3 nit; battery 47 / 58 PASS (originals 47 / 55; 56–58 added, all FAIL).
