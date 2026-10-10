# Round 4 · seat A · executing agent (E468)

Surface: `git diff a3f3c58ca 57a256a96 -- docs/plans/PROGRESS-TRAILER.md`; ledger, battery and register read. Initial report written within 15 minutes; no builds, browsers or commits.

| ID | Severity | Where (timestamp in v1, or plan §) | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R4A-1 | should-fix | §2.1; §2.2 0:46–0:52; §3.1; PT3 | The new rewind specifies distances and an approximate speed, but not a timing map that satisfies its beat-grid and impact constraints. An executor must choose which instruction wins; §3.1 still says 0.25×. | Plan lines 49–50, 75, 124–125: at 62 m/s and 0.05×, the 2/4/6 m cuts are approximately +0.645/+1.290/+1.935 s after release, separated by 38.71 output frames, not multiples of 30. `568a1463f:src/player/Crossbow.ts:47` gives 62 m/s. `take.mjs:35–36,80,100` supports one constant speed per take, not a ramp. | Give PT3 an explicit ramp implementation and output-frame map derived from logged flight distances: beat-aligned era cuts, release and return-to-1× frames, impact at frame 3,000, fall before frame 3,120. Either solve speed from those frames or explicitly exempt distance cuts from the grid; remove the stale 0.25×. |
| R4A-2 | should-fix | §3.5; PT11 | The week-4 order supplies 12 seconds of savings, but calls the added chapter about 10 seconds and never allocates its play/lapse durations. The exact 3,600-frame drill still needs an invented allocation. | Plan lines 192–195 against §2.2: week 1's 6+4 becomes 2.5+1.5 (save 6); end cards 6→4 (save 2); Nine Dragon 6→5 and former showpiece Sky Reach 8→5 (save 4). With a 10 s addition: 60+10−12=58 s / 3,480 frames. With 12 s: 60+12−12=60 / 3,600. | State week 4 as an 8 s new lapse + 4 s new play beat, then list the resulting durations and cumulative frame boundaries. Keep the prescribed savings order. If the new chapter must be 10 s, specify which 2 s reduction is skipped instead. |
| R4A-3 | should-fix | §3.4; PT8 | The new stem fix does not supply the named instrument controls: htdemucs cannot independently unmute strings while keeping melody alone underneath day 1. The executor must invent another separation/generation method or change the arrangement. | Plan lines 174–176 prescribe “melody alone” then “+ bass and strings”. `scripts/steam-trailer/music_stems.py:12,20–21` writes the outputs of `separate`; `scripts/music/gen/stems.py:12–16,110–119` documents and uses drums / bass / other / vocals, with lead-instrument bleed in vocals. There is no strings or melody output. This is new evidence against R3C-4's replacement, not a repeat of the prompt-timing complaint. | Specify an arrangement using the outputs the tool actually provides: instrumental other/vocals → add bass → add drums → full mix, with gain/fade events on chapter boundaries. If isolated strings are essential, name and budget their separate source rather than attributing that capability to htdemucs. Recommend the existing four-stem route. |

Spot checks and round-3 closure: the main beat sheet totals **play 25 s, authoring 25 s, cards 8 s + close 2 s = 60 s / 3,600 frames**; every listed main boundary is on a 0.5 s grid. This closes R3B-3/10 and R3C-1/14 for the main sheet, with the internal rewind exception above. `git show b39cc8b8a -- sources/WILDSHARD.md` contains “you use claude code as the UI for building”; the seven-word excerpt is verbatim, and the author/commit time is **16 Sep 22:22:54 −0500**. PT6 now fits the 2 s slot.

Week-4 arithmetic under the recommended 12 s allocation, in film order: cold 2 + origin card 2 + day-1 wall 3 + day-1 play 5 + folded week-1 lapse 2.5 + play 1.5 + week-2 lapse 5 + play 4 + week-3 lapse 5 + play 4 + new lapse 8 + play 4 + breath 2 + rewind 6 + grid 2 + end cards 4 = **60 s / 3,600 frames**. All durations and cumulative boundaries remain on the 0.5 s grid; the unmodified 10 s addition instead ends at 58 s. This is a proposed explicit allocation, not one supplied by the current plan.

R3 closure by seat: **A** 1/2/4 landed, 3 still needs R4A-2; **B** 1–3/5–12 landed, 4 needs R4A-1; **C** 1/3/5–10/12–15 landed, 2 needs R4A-1, 4 needs R4A-3, 11 needs R4A-2. Concrete answers include two-step QA with honestly dated references; per-stage counts (git confirms 232 / 1,483 / 3,117); near-spawn cut plus inset expansion; tile wall with simultaneous arrivals; three named week-3 verbs and a ≥2 s hold; impact-linked sound; two end cards; modest grid claim; `grade: 'none'`; new cold-open start pose. These are plan-level closures, not claims that the final takes already pass. No settled ledger choice is reopened.

Battery walk (plan-level; the finished film is still to be built):

| Scenario | Result | Execution path |
|---|---|---|
| S1 | pass | Real grapple immediately; the six-word repo-origin card starts at 2 s and holds to 4 s. New frame-0 pose required. |
| S2 | pass | §2.3 defines inputs, normal camera, collision/AI, allowed starts and forbidden manipulation; receipts and frame review reject failed takes. |
| S3 | pass | PT1's day-1 input-driven hunt is the proven starting rig; PT3 films the 5 s play beat with fixed delta, substeps and viewmodel. |
| S4 | pass | PT2 chooses monotonic real stages; PT5 re-renders wide with counter/date/rail, then the near-spawn crane and inset expansion; PT6 supplies sourced Claude Code wording. |
| S5 | fail | Data and reuse boundaries are named, but the new chapter's allocation is absent and the stated 10 s addition does not balance the full savings order (R4A-2). |
| S6 | pass | L11/PT0 settles one 1920×1080/60, 60 s master; §2.1 explicitly says letterboxed on the phone. |
| S7 | fail | Era SFX and loudness checks are specified, but the ramp timing and unsupported instrument-stem schedule still need R4A-1/3. |
| S8 | pass | External shots/cut/titles interfaces have named landed commits; §5 keeps shared-tool edits with their owner and excludes TRAILERS rows. |
| S9 | fail | The rewind has a real near stag, visible bolt thresholds and a real-speed payoff; exact capture/conform timing still conflicts with the universal grid (R4A-1). |
| S10 | pass | Counts/day/spans are generated per shown SHA; quote and timestamp verify; no unsupported shard count is advertised. |
| S11 | pass | PT2 requires one matching-ground spot, four visibly improving frames and a day-22 stag; failure explicitly escalates to Jake before PT3. It does not silently certify the unshot comparison. |
| S12 | pass | Era footage and authoring lead, distinct score and sound, and a new grapple start pose distinguish this cut from the alpha. |

Rows PT2–PT11, executable without guessing:

| Row | Answer | Reason |
|---|---|---|
| PT2 | yes | Scout/measure/select with named builds, contact sheets, criteria, fallback and an explicit escalation gate. |
| PT3 | no | Ramp/output timing needs R4A-1; landed constant-speed support alone does not define the new ramp. |
| PT4 | yes | Named HEAD shots, external loader and new cold-open pose; landing and thumbnail are capture acceptance criteria. |
| PT5 | yes | Lengths, stage selection, motion limits, composite format and hand-off are specified; PT2 owns the actual stage/pose selection. |
| PT6 | yes | Verified source excerpt, diff presentation, 2 s length, size and receipt citation. |
| PT7 | yes | Landed custom titles interface, git formulas and chapter/stage assertions; card copy meets the per-block rule. |
| PT8 | no | The named stem schedule cannot be implemented from the named separator's outputs (R4A-3); rewind placements also depend on R4A-1. |
| PT9 | yes, after PT3 | One shared EDL/conform and explicit neutral shard grade; ramped source frames must first exist. |
| PT10 | yes | Jake owns verdict/distribution; record his words and put resulting work in this plan. |
| PT11 | no | Exact frame-count acceptance lacks a balanced, explicit new-chapter allocation (R4A-2). |

The recommended timing and four-stem repairs are implementation decisions. If Jake wants isolated melody/strings rather than the available stems, that is his artistic choice; recommend the existing four-stem route. PT2 already names Jake as the decision owner if no honest improving comparison survives scouting.

Verdict: Most round-3 fixes are executable, but PT3's ramp, PT8's stem schedule and PT11's week-4 allocation still require guesses; resolve those three contracts before execution.
