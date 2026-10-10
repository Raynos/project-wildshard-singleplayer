# PROGRESS-TRAILER council — round 3, seat A (executing agent)

Surface: `git diff 556456b44 a3f3c58ca -- docs/plans/PROGRESS-TRAILER.md`, the R2 register, and S1–S12. PT1 is accepted as proven; this is a plan review, not a capture run. First draft written within the first 20 minutes, then refined against source. Only this seat file was written; no scratch artifacts, builds, browsers, models or commits.

## Findings

| ID | Severity | Where (plan §) | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R3A-1 | should-fix | §3.1 frame check; PT2–PT3 | The defined QA cannot ask the stated question or certify a standing eye. Its standing-eye criterion also conflicts with the required aerial lapse frames. | Plan:125–126; `scripts/decide/decide.py:216–221` accepts images, `--set`, and `--force-flag`, no question; `sets/capture-status.json` checks world/loading/menu/error, allows HUD, and does not test eye height or missing forest. | Name `qa --set capture-status <first> <middle> <last>` as the loading/menu check; separately require visual comparison to the named era references for streaming completeness, and standing-eye checks for play only. Record both results; aerial lapses use their intended pose. |
| R3A-2 | should-fix | §2.2 cold-open/terminal; §2.3 legibility | The new universal reading limit conflicts with the prescribed content, so PT6/PT7 must choose which rule to violate. | Plan:62 specifies an eight-word cold-open sentence; :71 allows a 12-word prompt; :98–99 caps anything read at seven words. The now-available `progress/trailers/tr5-lookout-session.cast` first prompt starts “You're helping build a Wildshard shard. In Sky Reach…” and runs far past 12 words. | Define limits per text block: split the cold-open into two simultaneous short lines, explicitly allow the terminal's verbatim ≤12-word prompt and require a new short-prompt session if TR5 cannot fit. Specify any verbatim excerpt and its honest presentation rather than substituting a different prompt. |
| R3A-3 | should-fix | §3.5; PT11 | The week-4 recipe gives no executable allocation of the 60 s budget after adding both a play beat and a lapse. Compressing only the oldest non-day-1 play beat cannot fund a chapter of comparable size. | Plan:165–168; current week-1 play is 5 s (:66), while week-3 play+lapse is 13 s (:69–70). “Compresses first” names no next source of seconds or minimum durations; ≤6 rewind segments also lack explicit in/out allocation. | Give a duration allocation rule or a worked week-4 EDL totaling 3,600 frames: immutable spans, minimum play/lapse durations, what shortens next, and rewind segment boundaries. PT11 dry-runs that rule. |
| R3A-4 | must-fix | §2.2 Sky Reach; §3.3 camera speed; PT5 | The named overview-to-spawn crane cannot reach the promised match cut in eight seconds at ≤3 m/s. | Plan:69,140; `c9aaa62ab:art/far-reach/progress/cameras.json:103–108` puts `aerial-overview` at (0,130,90); `c9aaa62ab:src/shards/far-reach/manifest.ts` dev.spawn eye is DECK+1.7, with DECK=30 in layout.ts. The vertical move alone is 98.3 m; eight seconds allows 24 m, before horizontal travel. | Keep the slow overview lapse, then explicitly cut on a beat to a separate near-spawn crane for the final stage, ending on PT3's exact frame-0 pose. Specify that permitted authoring-camera cut; do not silently exceed the speed limit or move the player view. |

## Battery walk (plan passes mean executable specification, not footage approval)

| Scenario | Result | Steps through the plan |
|---|---|---|
| S1 | fail | 1. Start on the rim/target and land at 2.2 s. 2. Read the dated empty-repo card until 3.6 s. Hook and provenance are specified, but the card violates its own reading rule (R3A-2). |
| S2 | pass | 1. Select named SHA and record allowed spawn/look/quest start. 2. Drive held movement, look and weapon inputs. 3. Accept only real collision/AI/hit-test consequences; keep viewmodel and receipt (§2.3, PT3). |
| S3 | pass | 1. Build `568a1463f`. 2. Use the proven legacy adapter and `d01-hunt` to stalk/raise/fire. 3. Assert one frame per step and a kill; extend output/clock via PT3's explicitly pending work. |
| S4 | fail | 1. Scout loadable monotonic SHAs. 2. Re-render wide camera slices ending on day-22 play's pose: the crane cannot reach it at the stated speed (R3A-4). 3. Add rail/date/counter and real session prompt: aerial QA and reading checks conflict (R3A-1/2). |
| S5 | fail | 1. Append chapter data and capture only new material. 2. Recompute rewind. 3. Fit 60 s by compressing old play: no complete duration algorithm (R3A-3). |
| S6 | fail | 1. Conform 1920×1080/60, 60 s. 2. Deliver the same letterboxed master on phone, YouTube/X/site. Format is settled by PT0; prescribed text fails the phone rule (R3A-2). |
| S7 | pass | 1. Generate four additive 120-bpm cues. 2. Pick by scan or update beat boundaries. 3. Render era synth/file SFX at logged events, add trailer impacts. 4. Measure encoded −14 LUFS/−1 dBTP (§3.4). |
| S8 | pass | 1. Keep historical rig/data in own directory. 2. Use external shot/cut loaders. 3. Ask owner for titles/session interfaces; do not edit steam-trailer files or take TR9/CT rows (§3.2/§5). |
| S9 | pass | 1. Scout one compatible Pine pose and a day-22 stag. 2. Author one hip-fire input track and replay four builds. 3. Slow sim to 0.25×, cut at matching bolt distance, finish on a real kill (PT2/PT3); scouting may replace an unshootable beat honestly. |
| S10 | pass | 1. Derive UTC−5 dates/dayOf, counts, filtered SHARDS and SHA spans. 2. Render titles from these values. 3. Assert chapter counts/day 24/six shards (PT7); checks below confirm the claimed constants. |
| S11 | fail | 1. Scout same spot/eye (<0.1 m) and verb on all builds. 2. Drop later stages reading worse. 3. Check contact sheets: the declared QA does not assess comparative quality or streaming completeness (R3A-1). |
| S12 | pass | 1. Lead with dated history and four-era rewind. 2. Separate authoring frame from full-bleed play. 3. Use era sound and additive score: the structure differs from the alpha (§2.1/§3.4). |

## PT2–PT11: could I execute without guessing?

| Row | Answer | Reason |
|---|---|---|
| PT2 | no | Scouting deliberately resolves spots/verbs/stages; that is legitimate work. Its required frame-check verdict is underspecified/mismatched (R3A-1). |
| PT3 | no | Clock/frame/input/bolt-distance work is explicit and implementable; “checked” still inherits R3A-1. |
| PT4 | yes | Named shots, HEAD capture interface, in-points and master format. |
| PT5 | no | Stage count/durations and the authoring rail are defined; the Sky camera hand-off is physically incompatible with its speed cap (R3A-4). |
| PT6 | no | Session acquisition/new-session fallback and 3 s timing are defined; seven versus twelve words needs R3A-2. |
| PT7 | no | Computation/tests and external titles interface are defined; contradictory reading rules need R3A-2. |
| PT8 | yes | Cue selection, boundary adjustment, era sound, events, credits and encoded loudness checks are defined. |
| PT9 | yes | One EDL, historical null grade, shared conform, 16:9 deliverable and phone copy. |
| PT10 | yes | Deliver cut, obtain Jake's verdict/distribution choice, record words and put resulting work in plan rows. |
| PT11 | no | README and dry-run are specified, but no complete week-4 duration policy (R3A-3). |

## Round-2 fix coverage

- **R2B:** 1–6, 8–9, 12–13, 15–17 landed in the diff (honest stills/date/shard definition, external titles request, four-take hit, corrected poses, lapse adapter, neon-stage correction, per-lapse lengths, context and edit format). B7's QA fix has R3A-1; B10's corrected Sky endpoint creates R3A-4; B11/B14's prompt/card fixes collide with the added universal text rule (R3A-2).
- **R2C:** 1–10, 12–17, 19, 21 landed as specified (slow replay, shared input/bolt distance, real hit, compressed still clock, reading time, escalating shots, Nine-only week 2, active week 3, wide Sky re-render, slow staged lapses, breath, era sound, additive cue, CTA, camera adapter, null grade, legal starts and approximate halves). C9/C10 have the adjacent crane conflict (R3A-4); C11/C18's new frame/readability rules create R3A-2; C20 preserves the rewind but leaves the revised duration recipe incomplete (R3A-3). These are new evidence at changed lines, not re-arguments of settled choices.

## Technical spot checks

- **speed/sub:** `speed/(60×sub)` is correct sample delta; app era needs `setCapture(60×sub/speed)`. `c9aaa62ab:src/engine/core/clock.ts:40–45` returns `1/captureFps`; shared `capture.mjs:185–195` already uses this reciprocal and sim-time tick. Historical `take.mjs:41,49,91–97` is still 1/60, five-digit JPEGs and no sub-loop, as PT3 explicitly says to extend. This is pending work, not a failed PT1 claim.
- **edit format:** `scripts/steam-trailer/edit.mjs:56–78` reads `<frames>/<shot>/meta.json`, `{sub, shard}`, zero-based `%06d.jpg`; `video` branch (:47–54) accepts finished clips without per-shard grade. `grade: 'null'` reaches the null fallback (:71). The global vignette/grain (:88) remains even with null grade; “no finishing grade” should be understood as no per-shard grade.
- **QA:** frozen sets rather than ad hoc questions; see R3A-1. No model/browser was run.
- **dayOf/counts/span:** git commit timestamps are 16 Sep 22:13:06 and 23:58:57 UTC−5; rounded elapsed time is 106 min. Calendar difference gives chapter days 1/8/15/22 and 9 Oct day 24. `git rev-list --count` returns 29/624/2495/5729. Sky span is 42 h 55 m 37 s, honestly rounded to 43 h.
- **SHARDS at c9aaa62ab:** `src/shardList.ts` imports `SHARDS` from ignored/generated `src/shards.generated.ts`; that revision's `scripts/gen-shards.mjs:43–46,53–75` discovers manifest folders. Git has seven manifests including `_template`; filtering it yields Driftwood, far-reach, Nalati, Nine Dragon, Pine and sunscar-dunes: six. Use this historical generator/manifest source, not a literal array parsed from shardList.ts.
- **Pine starts:** verified `568a1463f:src/main.ts:92` has `(0,-236,π)`; `8a58b9d1e:src/chunks/pine-hollow.ts:21` and `c9aaa62ab:src/shards/pine-hollow/layout.ts:29` have `(0,-235,π)`. PT2 correctly treats these as scouting starts rather than a proven four-era firing pose.
- **Shared titles/session:** after the reviewed diff, `af87b952b` supplied `titles.mjs --titles-html` (current :14–16) and committed TR5's cast. This resolves the interface acquisition, without granting permission to modify the owner's files.

Verdict: Round-2 fixes substantially landed, but one impossible Sky crane is must-fix, and QA semantics, conflicting text limits and the week-4 duration budget still require three should-fixes before execution.
