# Round 4 · seat B (Claude: coverage + a code-grounded audit of the round-3 fixes)

Reviewed: `git diff 1a9390cc..HEAD -- docs .claude` (5991eb01, 2685eb3d), the 42 R3 register rows, battery 1–66. Each R3
row's old wording was grepped across the plan, 06, 04, 03, 05, the README, both skills, both outlines and E359. Each new
claim was checked against this tree, `main` where it matters, and `docs/plans/game-normalization/`.

**Verified true (no finding):**
- Counts: the register holds 222 rows (119 + 61 + 42); R3 is 8 / 27 / 7 with 35 accepted; the battery has 66 rows and
  its R3 column has 43 PASS of 55; the State line, C row, E359 Status and the round summary agree. The touchpoints
  ("twelve, thirteen with P7") count right. The ledger is D1–D56 + R1–R33 everywhere it is cited (E359:111 is a
  round-2 Handoff, history).
- `claude --help`: `--permission-mode` accepts `bypassPermissions`; `~/.claude/settings.json:33` sets
  `defaultMode: "bypassPermissions"`, so "the mode agents use" is true. `-p` "Print response and exit" (so the
  relaunch is needed).
- `?chunk=<slug>` on a hidden shard: `chunk` is on `lint/url-params.json` `harness`; the spec keeps
  `shardSlugFromUrl()` / `findShard(slug)` over all of `SHARDS` (02-foundations:1302–1304), and the hidden `_template`
  is booted by the gate (11-finish Z1), so a hidden shard boots from the param.
- R33's premises: `matrix.mjs` lists every `src/shards/*/` with a `manifest.ts` (03-harness-gate:800–804); 5 macOS jobs
  at once (:639); a shard with no baselines bootstraps on its first gate run (11-finish:87–88); gate legs are
  `"gate": true` legs, poses live in `scripts/parity/poses.mjs` (03-harness-gate:310–318). No exemption exists in the
  spec, so E10 owning `gateExempt` is right.
- `run_codex.py`: one `t0` for the batch (:29–31), `--timeout` read from argv, unknown flags ignored (:13–14): T14's
  claims hold. `webkit-mem-reading.mjs` takes `--url` (:18, :39).
- Landed everywhere: E3 → T7 (§5, 06 §10.2); E10 + the lab shard (plan, §5, 06 §10.2); dispatch steps 2–4, §run
  `mode` / `until`, the hold (06 §2, §10.7, both skills); the two look rows, the catch-all note row, the after-P8 and
  added-place rows (06 §10.3); the hard list and slope / sightline / T9 fallbacks; the boss gate by scope (06 §4.1,
  §10.4, P8, skill P8); the verdict log (P7, P9, P17, skill boundary); T7 / T14 / T15 / T17; taps, `version.json`,
  E1–E10; plan §2; S3 / sketch E8a; README / 05 wording.

## Findings

| ID | Severity | Location | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R4-B1 | must-fix | Plan P16 (:291); auto P16 (:165–167) | **`scripts/iphone-mem-reading.sh` can't read the pilot.** It is hard-coded to Nalati: pine→nalati twice, then Nalati's fps. It takes only `--base` / `--fps` and exits 2 on anything else. So "run `scripts/iphone-mem-reading.sh` / `webkit-mem-reading.mjs`, which drive a Safari tab at `?chunk=<slug>`" is false for the first script. Run as written, it records **Nalati's** memory as the pilot's reading, and Done-when 1 rests on that reading. P16 also leaves out the precondition: a Safari tab already open on the game's origin. Without it the script exits | iphone-mem-reading.sh:5–6 ("one Safari tab open on …/version.json in front"), :20 (flags), :31 ("no Safari tab … open $BASE/version.json"), :34, :37, :40 (`?chunk=nalati-grasslands`); the same on `main` (`git show main:scripts/iphone-mem-reading.sh`); webkit-mem-reading.mjs:18 (`--url`) | P16 + skill: "Jake connects the phone (Web Inspector on, Low Power off) and opens `<prod>/version.json` in Safari. Start the bridge as iphone-mem-reading.sh:22–30 does, then `node scripts/webkit-mem-reading.mjs --ws=<page ws> --tag=<slug>-p16 --blank-first --url=<prod>/?chunk=<slug> --fps=150` (loading, Explorer and world peaks)". Or a named row adds `--chunk <slug>` to iphone-mem-reading.sh |
| R4-B2 | should-fix | 06 §7 (:277–290); auto P16 (:161) | **06 §7 missed two round-3 fixes, and three places cite it.** (a) The reading is still R3-B6's old text: "as `nine-dragon-mobile-multidraw.md` does it: Jake plugs the phone … and opens the hidden pilot; the agent samples … (Safari Web Inspector + the device logs)". Done-when 1 ("the method in 06 §7") and 04 §10 send the executor there. (b) The final board lists "every logged gap and every 'decided for you'", with no blocked branches. R16 and 06 §5 say a rung-4 decision "waits for Jake on the final board", and plan P16 lists "every blocked branch". The skill's P16 doesn't | 06:286–289; plan:159; 04:212–213; 06:283; plan:124, :291; 06:222–223; auto:161 | 06 §7 takes R4-B1's recipe. The final board (06 §7, skill P16) adds "every blocked branch: the rung-4 decision Jake must take, with its evidence" |
| R4-B3 | should-fix | 06 §10.4 rung 3 (:429); R16; 06 §5; auto BUILD (:140) | **Rung 3 still has a gap, and the contract text was never updated.** (a) 06 §10.4, the ladder R16 and the skill point to, still reads "Jake before P9 (guided); after P9b, the judges". It has no P9–P9b window and no "inside the approved design" bounds. (b) **Zero-shot before P9 still has no decider.** R16, 06 §5 and the skill cover "Jake before P9 (guided)" and "from P9 / between P9 and P9b, the judges". A zero-shot P8 failure (P19's whole target, battery 66) matches neither. R3-B4's part (a) was stamped fixed without it | 06:429; plan:124 "Jake before P9 (guided); between P9 and P9b and after it, the judges"; 06:224–225; auto:140 "From P9 on" | One sentence in all four places: "rung 3: guided before P9 → Jake; zero-shot at every step, and guided from P9 on → the judges, inside the approved design (06 §5's bounds)". Copy those bounds into 06 §10.4 |
| R4-B4 | should-fix | auto BUILD, Notes (:139) | **R3-C7's fix missed the skill, so a gate-reopening note follows two rules.** The skill says "A gate-reopening note goes back to Jake as a decision while the run continues elsewhere". 06 §10.3 now says "Jake's note is itself the decision, so it is applied …, not asked back; only a note that is ambiguous gets one clarifying question". The executor runs the skill (battery 23) | auto:139; 06:389–391 | Skill: "A gate-reopening note is Jake's decision: apply its 06 §10.3 row; ask one clarifying question only if it is ambiguous" |
| R4-B5 | should-fix | auto P9 (:116–117); T6; E10; auto P16 vs §Z | **R33 is applied in only some places.** <br>• The skill's P9 still says "Record the gate baseline when look, layout or content changed". 06 §4.2 says that while the pilot is gate-exempt "its commits record no gate baseline", and an exempt shard has no gate job to record one. The sentence belongs at P17: after P16 every look / layout / content fix re-records the baseline (03-harness-gate §16). <br>• R33 and the skill's P16 say "T6 its gate poses", but T6's row makes no poses for `scripts/parity/poses.mjs`. <br>• E10 never names the `matrix.mjs` edit. matrix.mjs reads manifests without a checkout. <br>• Zero-shot: §Z keeps the shard "hidden and gate-exempt until Jake's word". The shared P16 (the build "runs as in guided mode") takes the shard out of the exemption before Jake has seen it | auto:116–117; 06:188; 03-harness-gate:1150–1153, :310–311, :800–801; plan:131, :257, :246; auto:164, :184; 06:306 | Move the baseline sentence from the skill's P9 to P17. T6 adds "at P16: the pilot's gate poses in `scripts/parity/poses.mjs`". E10 adds "`scripts/gpu-gate/matrix.mjs` skips a manifest with `gateExempt`". P16 in zero-shot: "leaves the exemption on Jake's word" |
| R4-B6 | should-fix | Plan P9b (:284); auto P9b (:124–125); 04 §8 step 1 (:157–158); 06 §10.6 (:465) | **R3-A6's route-leg targets reached only 06 §4.3 and T5.** Plan P9b captures "every place's planned camera" and is done when "every place has a target". The skill's P9b step 1 captures "every place's camera". 04 §8's frame step uses "the place's planned camera … `design/cams/<place>.json`". Yet P12 (plan, skill, 04 §8 step 2) needs "the P9b target as the second input" **per route leg**. An executor following the plan or the skill makes no leg targets (battery 63). 06 §10.6's P9b count doesn't include them | as cited; 06:195–199 (the only full statement) | Plan P9b and the skill's P9b: "+ the route-leg cameras T5 picks (`design/cams/leg-<id>.json`), each re-edited to the bible with the nearest place's mockup as the second input". Done-when: "every place and every route-leg camera has a target". 04 §8 step 1: "or the leg's camera". 06 §10.6: count the leg targets |
| R4-B7 | should-fix | 06 §8 Launching (:310–313); auto §Z (:185–187); auto description (:3); dispatch steps 2–3 | **A launched session can't find the skill from the invocations given.** The relaunch prompt is `"resume <slug>"`. The skill's triggers ("make / build / WorldClaw a shard", "zero-shot <sentence>", a director) don't include "resume", and dispatch has no `resume <slug>` grammar: step 3 is keyed on `design.md` existing. A fresh print-mode session that gets "resume fjord-ferryman" has nothing that ties it to worldclaw-autonomous, and P18 must run "from the skills alone". P19's literal invocation isn't given either. Step 2 wants "zero-shot … naming a shard", but the grammar is "zero-shot <sentence>". A relaunch that repeats the sentence (battery 56) makes the slug choice again, and nothing guarantees the same slug. Also, the child inherits `HERDR_PANE_ID`, so its "set-label once per stage" overwrites the launching pane's herdr tag | auto:3; auto:27–35; 06:310–313; ~/.claude/set-label.sh:27–33 (keyed by `$HERDR_PANE_ID`) | Name the skill in every invocation: `"/worldclaw-autonomous zero-shot <sentence> until P5"` (P18); `"/worldclaw-autonomous zero-shot <slug> until P8"` (P19); relaunch `"/worldclaw-autonomous resume <slug>"`. Dispatch steps 2–3 parse `zero-shot <existing slug>` and `resume <slug>`. Add "resume <slug>" to the description. Launch with `env -u HERDR_PANE_ID`, or say a launched child never sets labels |
| R4-B8 | should-fix | 06 §10.2 single-stage + P8 rows (:352, :359); T1 (:252); auto §S | **R3-B10 / C15's single-stage fix stops on its own input list.** (a) `spec-check --scope slice` is in 06 and the skill only. T1's row and done-when build and test the full rules alone, and 06 §10.2's rule list doesn't say which rules "the shard rules" are. (b) A single-stage P8 reads P8's files: "spec.json, the region weights, design.md's slice". A director's shard has no region weights (and may have no `design.md`, §7 Q2), and the row says "Any other missing file → stop and name it". So a content-only P8 stops (battery 28) | 06:352, :359; plan:252, :268; auto:192–194 | T1 adds `--scope slice`: kept are ids, the slice's places inside the shard, routes as typed legs, signals, approach views. Skipped are 8–12 places, the required roles, entry roads, the 60 % estimate and the region rules. Add one fixture. Single-stage row: "a content-only P8 reads the slice spec and the shard's existing terrain (no region weights); the slice comes from the director's design" |
| R4-B9 | should-fix | Plan P7 (:278); 06 §3.4 step 2; visdev E9b + P7 (:86–87); E9; T5 | **P7 writes its leg test "in T5's format" two steps before any row defines that format.** P7 is §5 step 7. T5, the first row whose text defines or runs non-walk leg tests, is step 9. E9 (step 4), the first non-walk verb (the kit zipline), is done when it "pass[es] the walk test", and T5 calls it "the kit zipline from E9". So P7 implements an interface nobody has defined, and its done-when ("the leg test runs headless") has no runner | plan:278, :244, :256, :321–325; 06:108–109 | E9 owns the contract: a non-walk leg (kind, launch, target, radius, exit) and a headless runner (e.g. `scripts/worldclaw/leg-test.mjs`), with the kit zipline as its first test. T5 partitions the legs and calls it. P7 writes the new verb's test to that contract |
| R4-B10 | should-fix | 06 §10.4 style rung 5 (:442) vs T9 (:260) / 04 §8 step 7 (:185) | **R3-C5's stand-in fails R3-B5's hard T9.** A required slot that reaches rung 5 (the landmark, a vista's hero) "takes the sketch kit's stand-in restyled". T9's checks are now hard, and one of them is "sketch pieces replaced by final code models of the same footprint and colliders". T9's fallback ("swap the model") sends it back into the style ladder, so the slot loops to a blocked branch. E8a also has no stand-in for "a prop on a quest step" | 06:412, :437, :442; plan:243, :260; 04:185 | T9's sketch check exempts a required slot's logged rung-5 stand-in, which is on the gap list. E8a adds a generic prop block, or rung 5 names which stand-in a quest prop takes |
| R4-B11 | should-fix | R33 (:131); X1; E9; 06 §3.3 step 2 | **Nothing says when the lab shard and P18's shard are deleted, or where P3's mini-X1 runs.** R33: "they are deleted after use". No row deletes either one. The lab shard is still needed after X1 (step 3): E9's done-when runs in it (step 4), and the P3 mini-X1 (step 6) needs a place to render. Read literally, "after use" deletes it after X1 and breaks E9. The mini-X1 also never says that its pick is written to `scripts/worldclaw/scatter-sources.json`, which spec-check enforces at P5 | plan:131, :230, :244, :319–323; 06:91–93; 06:369 | R33: "the lab shard lives until the pilot's P11 (then deleted, by P17); P18's shard is deleted after P19's board (S1)". 06 §3.3: "the mini-X1 runs in the lab shard; its pick is appended to scatter-sources.json" |
| R4-B12 | should-fix | Plan Done-when 1 (:154); 04 §11 (:228) | **R3-C11's boss-by-scope rule didn't reach Done-when 1.** Done-when 1 needs "its weapon, enemies, boss and audio" whatever the scope. R17's slice scope builds "the slice's" content only, and P8 now logs a boss outside the slice as out of scope. So with that scope, P17's "Done-when 1 rechecked" can never pass, unless P13 builds a boss no gate tested. 04 §11's "boss beaten headless" is also unconditional | plan:154–155, :125, :282, :292; 06:178–179 | Done-when 1: "the boss, when the run scope holds it". 04 §11: add the same clause |
| R4-B13 | nit | Plan §5 estimate (:335–347) | R3-C13 added days to two lines but not to the total. The lines now sum to ~33–42; "Base" still says ~30–40. Jake's go reads this number. The "Per answer" row has a fourth cell | 2+9+6+2+2+4+3+4+1 = 33; 2+11+7+2+3+6+6+4+1 = 42 | "**~33–42**"; move "[R2-C19, R3-C13]" into the Days cell |
| R4-B14 | nit | Plan R18, R23, R33 order; 06:7; visdev §0 (:27) | The ledger lags its contracts. R23's §run list lacks `mode`, `until`, P0's answers and the hold rule. R18 still says "`claude -p` in the background", with no mode and no relaunch. R33 sits between R22 and R23. 06:7 says "council rounds 1–2". Visdev's needs list leaves out E3 (06 §10.2 P2–P3) | plan:126, :131–132; 06:7, :349; visdev:27 | Point R18 / R23 at 06 §8 / §10.7 with the new fields; move R33 after R32; "rounds 1–3"; add E3 |
| R4-B15 | nit | Plan §6 (:359); 03:117, :124 | R3-B14 / C18 left three spots. "the brief and D25 musts"; scatter "over the mask"; Blender output "spec, mask, GLBs" (the mask is now the region weights, 06 §10.1) | as cited | `design.md`; "over the region weights"; "spec, region weights, GLBs" |

## Battery

| # | PASS/FAIL | Why (the step that has no unambiguous answer) | Finding IDs |
|---|---|---|---|
| 1 | FAIL | P9: the skill records a gate baseline for an exempt pilot. P9b makes no leg targets that P12 can use. A gate-reopening note follows two rules. P7's leg-test format is defined two steps later. A required stand-in fails T9. The lab shard has no lifetime. P16's script reads Nalati | B5, B6, B4, B9, B10, B11, B1 |
| 2 | FAIL | Who decides the front is clear (judges P2–P6, no P7, P8–P9 judged). A P8 hard failure in zero-shot still has no rung-3 decider. The shared P16 ends the exemption, against §Z's "until Jake's word" | B3, B5 |
| 3 | PASS | T3: all three fail → stamp the discs over the best variant, logged | — |
| 4 | PASS | Object pad ≤ 1.5 m, else move along the ray to ≤ 15°, off route corridors; T9 | — |
| 5 | PASS | The style ladder; the landmark is a required slot, so it is never left empty | (B10) |
| 6 | PASS | Budget: the 7 levers, the next one(s) per round, ≤ 4 rounds; then the judges inside the design; then blocked | — |
| 7 | PASS | `waitingOn: codex-quota` + the reset time; resume after it; Qwen never ships a reference | — |
| 8 | PASS | `run-locked.sh` queues it; the main agent waits in the background | — |
| 9 | PASS | E1 extent → `heightRange`; T4 edge ramps; place pads; the slope gate + its fallback | — |
| 10 | PASS | R6: < 1 apart → J1 + J2 mean, else J3 + the median | — |
| 11 | PASS | R26: code, whole | — |
| 12 | PASS | Walk / reach fallback (re-grade, bench, move dressing), then the judges, then blocked | — |
| 13 | PASS | The after-P9b look row now ends at P14 → P15 → P16 (a new board + reading); layout and content kept | — |
| 14 | PASS | A move before P8: P5 maps + twins + the mockups that see it; the note is the decision | — |
| 15 | PASS | `scatter-sources.json` kind × route; spec-check; P11 | — |
| 16 | PASS | Stairs are code (D19); entered → code whole (R26) | — |
| 17 | PASS | E1's `extent`; E6 opens `kitLook`; N0 logs | — |
| 18 | PASS | T9 traversal views + clear cones after dressing | — |
| 19 | PASS | T9 is hard. Its fallback (re-seat, trim, move along the ray, swap), then the judges (resize or re-seat; no place move), then a blocked branch for Jake's final board | — |
| 20 | PASS | Frames are always shot into the durable folder; a late time-lapse says what it covers | — |
| 21 | PASS | P7 → "dull" → P2, places and bible kept; a second "dull" cuts the verb; days from the per-pitch adds | (B9) |
| 22 | PASS | The beat / slice row; P9 replay | — |
| 23 | FAIL | Red lighthouse → an exception line. Hub to the beach: 06 §10.3 applies it as Jake's decision, but the skill sends it back to Jake | B4 |
| 24 | PASS | Rungs 1–3, then a kit / code model, then not placed (not a required slot) | — |
| 25 | PASS | Signals are T9 (hard); fallback: move the dressing, or raise the signal ≤ 20 % | — |
| 26 | PASS | R11 bands by distance | — |
| 27 | PASS | twin-check ids and values; `design.md` owns intent | — |
| 28 | FAIL | `spec-check --scope slice` belongs to no row. A content-only P8 lists "the region weights", which the director's shard lacks, and "any other missing file → stop" | B8 |
| 29 | PASS | R12 / E7 | — |
| 30 | PASS | R32 sizing, freeze, ≤ 2 rounds, leftovers stay asks | — |
| 31 | PASS | `waitingOn: jake` → hold, re-send at 48 h, Handoff at 96 h; the answer goes into the verdict log before advancing | — |
| 32 | PASS | P14 is a pre-check; 2.3 GB physical → P14 reopens | (B1) |
| 33 | PASS | The kit zipline is an existing verb after E9: no P7 | — |
| 34 | PASS | E8a stand-ins; P8 grey rows with phases; T16 real strikes (all-content scope) | — |
| 35 | PASS | P9b edits a capture of the pilot's grey world | — |
| 36 | PASS | R20 `db` + `assets`, pagination; notes at step boundaries | — |
| 37 | PASS | Freshness by output bytes | — |
| 38 | PASS | J3 on the split; an evidenced must-fix blocks | — |
| 39 | PASS | T8 `on` support; flagged, never dropped | — |
| 40 | PASS | P7 ships the glider's leg test; reach = navmesh + tested links; glide eye path in the bands | (B9) |
| 41 | PASS | T5 writes walk legs; none → error | — |
| 42 | FAIL | Deploy and taps are clear, but the skill's P9 tells the executor to record a gate baseline that 06 §4.2 forbids for the exempt pilot | B5 |
| 43 | PASS | 1.3 GB > 1.0 GB Explorer → P14 reopens | (B1) |
| 44 | PASS | E6 kit look; P11's style check covers kit pieces | — |
| 45 | PASS | The durable frames folder; T13's two-session dry run | — |
| 46 | PASS | E8a has no later dependency | — |
| 47 | PASS | Visdev → autonomous §0 step 4 (guided) + P0 → back to P1 | — |
| 48 | FAIL | Stop logic is now clear (§run `until`, step 2). But the relaunch `"resume <slug>"` names no skill and isn't in the skill's triggers, and P19's literal invocation isn't given | B7 |
| 49 | PASS | Palette = taste → the after-P9b look row; the style check re-runs against v2 | — |
| 50 | PASS | R18's caps rule it out | — |
| 51 | PASS | 06 §10.1 phone copies (T7 / P9b) | — |
| 52 | PASS | J3 joins; tie-breaks in order | — |
| 53 | PASS | E10: navmesh, KTX2, packs, unused-assets for an opted-in hidden shard | — |
| 54 | PASS | `--max-parallel 6`: 6 start; per-job timeout | — |
| 55 | PASS | Same as 47 | — |
| 56 | FAIL | Relaunching "zero-shot <same sentence>" leaves the slug to be chosen again (step 2 needs "naming a shard"), and the documented relaunch `"resume <slug>"` doesn't reach the skill | B7 |
| 57 | PASS | §5 step 2: E3 → T7 | — |
| 58 | PASS | The boss is a required slot → the restyled kit stand-in with phases; T16 beats it; a logged gap | (B10) |
| 59 | PASS | The catch-all note row: the named things; T16 / budget re-run | — |
| 60 | PASS | The boss is outside the slice → P8 logs it as out of scope | (B12) |
| 61 | PASS | Added place: concept (P4) + mockup (P6, judged) + P9b target; not on the critical path, so no replay | — |
| 62 | PASS | The before-P9b look row: bible v2 by edit; concepts and mockups re-edited; nothing later exists yet | — |
| 63 | FAIL | 06 §4.3 defines leg targets. Plan P9b (and its done-when), the skill's P9b and 04 §8 step 1 don't make them, but P12 needs them | B6 |
| 64 | PASS | E10 creates `worldclaw-lab`; its done-when needs no pilot | — |
| 65 | PASS | The lab shard is gate-exempt (E10), so there is no job and no effect on newest-green | (B5) |
| 66 | FAIL | Zero-shot P8 is "before P9", and only guided has a rung-3 decider there. 06 §10.4 still says "after P9b" | B3 |
| 67 | FAIL | **(new)** P11: the landmark lighthouse fails all five style rungs and takes the restyled sketch stand-in. At P12, T9 (hard) checks "sketch pieces replaced by final code models". Can P12 be marked done? | B10 |
| 68 | FAIL | **(new)** P16: the agent runs `scripts/iphone-mem-reading.sh` for the pilot `fjord-ferryman` as P16 says. Which shard's memory lands in the reading recorded for Done-when 1? | B1, B2 |
| 69 | FAIL | **(new)** §5 step 7: P7's glider writes its leg test "in T5's format", but T5 is step 9 and E9 defines only a walk test. Which interface, and what runs P7's "the leg test runs headless"? | B9 |
| 70 | FAIL | **(new)** X1 is done, and R33 says the lab shard is "deleted after use". At step 4, E9's fixture runs "in the lab shard"; at P3 a direction's route has no scatter-sources row (mini-X1). Where does each run, when is the lab deleted, and where does the mini-X1's pick go? | B11 |
| 71 | FAIL | **(new)** P0 run scope = world + one session slice without the boss. At P17, "Done-when 1 rechecked" needs "its weapon, enemies, boss and audio". Is the pilot done? | B12 |

## Verdict

1 must / 11 should / 3 nit. Battery: 57 / 66 originals PASS (FAIL: 1, 2, 23, 28, 42, 48, 56, 63, 66); 67–71 added, all
FAIL → 57 / 71.
