# Register: the progress trailer council (E468)

Every finding, across rounds. Status: `fixed` + commit · `rejected` + reason · `settled` · `parked` · `escalated`.

| ID | Round | Seat | Severity | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| R1A-1 | 1 | A | must-fix | 0–3 s | The title establishes a progress story, but the opening offers no action or visible transformation to earn another three seconds. | fixed | PROGRESS-TRAILER.md §2.2 cold open |
| R1A-2 | 1 | A | must-fix | 3–9, 15–20, 24–26 s | Eye-height camera movement is not first-person play; v1 supplies neither half of L2. | fixed | PROGRESS-TRAILER.md §2.3, PT3 |
| R1A-3 | 1 | A | must-fix | Capture recipe / S3 | The Steam capture cannot simply point at every historical build | fixed | PROGRESS-TRAILER.md §3.1 era adapters |
| R1A-4 | 1 | A | must-fix | Capture timing | Current default subframe timing disagrees with the “120 Hz” promise: two samples advance two 1/60 simulation steps for each 1/60 output frame | fixed | PROGRESS-TRAILER.md §3.1, §3.2 --sub 1 |
| R1A-5 | 1 | A | must-fix | HEAD gameplay | Old held-key helpers can produce a stationary shot at HEAD: movement now reads InputService, not the manually edited key set. | fixed | PROGRESS-TRAILER.md §3.2 InputService request |
| R1A-6 | 1 | A | should-fix | Authoring half / S4 | Material exists, but “all captures” is neither a clean time-lapse nor “nothing to finished.” Existing encodes also omit later archive captures. | fixed | PROGRESS-TRAILER.md §3.3 curated stages |
| R1A-7 | 1 | A | should-fix | Authoring identity | A time-lapse proves visual change, not Claude Code authorship or a causal link to the terminal beside it | fixed | PROGRESS-TRAILER.md §2.3 honest authoring, PT6 |
| R1A-8 | 1 | A | must-fix | Repeatability / S5 | Reusing shot names across dates can silently reuse the wrong footage; errorful shots can be marked complete. | fixed | PROGRESS-TRAILER.md §3.1 receipts + cache |
| R1A-9 | 1 | A | should-fix | Distribution / S6 | Portrait v1 is playable on the phone, but format remains an execution choice; automatic wide/portrait conversion damages the authoring beat. | fixed | PROGRESS-TRAILER.md §2.1, PT0 |
| R1A-10 | 1 | A | should-fix | Sound / S7 | The orchestral rise has no gameplay events to land on, and the final encode exceeds the intended peak ceiling. | fixed | PROGRESS-TRAILER.md §3.4 |
| R1A-11 | 1 | A | should-fix | Pipeline ownership / S8 | Reuse needs an explicit interface; the current shot/cut loaders require modules inside the other agent's owned directory. | fixed | PROGRESS-TRAILER.md §3.2, §5 |
| R1A-12 | 1 | A | should-add | 21–26 s / S9 | Add one authored-place-to-play payoff; it changes which frames and player route are captured, and supplies the missing rewind moment. | fixed | PROGRESS-TRAILER.md §2.2 0:37–0:51 windmill payoff |
| R1B-1 | 1 | B | must-fix | v1 18.25–21.25 s | The "remastered" Pine Hollow is a bare gravel plain with no pines, so the week-2 remaster looks *worse* than day 1 | fixed | PROGRESS-TRAILER.md §3.1 warm-up + era frame check, PT2 |
| R1B-2 | 1 | B | must-fix | whole video | There is no gameplay | fixed | PROGRESS-TRAILER.md §2.3, PT3 |
| R1B-3 | 1 | B | should-fix | v1 3.0–9.15 s | The day-1 tour runs 6.15 s (21 % of the video) with a near-static camera: frames 3–9 s barely change | fixed | PROGRESS-TRAILER.md §2.2 day-1 stills + play |
| R1B-4 | 1 | B | should-fix | inventory | A real first-person gameplay trailer from day 3 was ignored | parked | §1 lists it; HEAD and era re-captures beat its 1600×900 HUD frames |
| R1B-5 | 1 | B | should-fix | cards | The facts that make the hook are missing | fixed | PROGRESS-TRAILER.md §2.2 cards, PT7 |
| R1B-6 | 1 | B | should-fix | 9.15–15.15 s | Neither week-1 shot shows life | fixed | PROGRESS-TRAILER.md §2.2 week-1 play beats |
| R1B-7 | 1 | B | should-fix | audio | The audio is music only, with no SFX at all (L7) | fixed | PROGRESS-TRAILER.md §3.4 |
| R1B-8 | 1 | B | should-add | inventory | History captures exist for only two shards, and in only one format | fixed | PROGRESS-TRAILER.md §3.3 (portrait archive = scouting aid; re-render) |
| R1B-9 | 1 | B | should-add | S8 | steam-trailer's `capture.mjs` cannot film the history as it stands | fixed | PROGRESS-TRAILER.md §3.1 own rig, §3.2 |
| R1B-10 | 1 | B | should-add | authoring half | No real Claude Code session from the past three weeks is on disk as video or as a cast | fixed | PROGRESS-TRAILER.md §2.2 0:54, PT6 |
| R1B-11 | 1 | B | nit | 0–3 s | The title sits over a dim, nearly static trail | fixed | PROGRESS-TRAILER.md §2.2 cold open |
| R1C-1 | 1 | C | must-fix | 0:00–0:29, every shot | There is no gameplay at all | fixed | PROGRESS-TRAILER.md §2.3, PT3 |
| R1C-2 | 1 | C | must-fix | the whole video vs the shipped alpha | v1 has less gameplay than the trailer that already ships | fixed | PROGRESS-TRAILER.md §3.2, PT4 |
| R1C-3 | 1 | C | must-fix | 0:03–0:09 vs 0:18–0:21 | The one "same place, later build" beat makes the game look worse | fixed | PROGRESS-TRAILER.md PT2 (drop beats that read worse), §2.2 rewind moment |
| R1C-4 | 1 | C | must-fix | 0:00–0:03 | Fails the scroll test | fixed | PROGRESS-TRAILER.md §2.2 cold open |
| R1C-5 | 1 | C | should-fix | 0:09–0:15, 0:27–0:29, every transition | Low energy | fixed | PROGRESS-TRAILER.md §2.2 hard cuts on hits, §3.4 |
| R1C-6 | 1 | C | must-fix | the audio, 0:00–0:29 | The music is a menu loop, not a trailer cue | fixed | PROGRESS-TRAILER.md §3.4 new cue |
| R1C-7 | 1 | C | must-fix | 0:15–0:18 and every shot | There are no sound effects | fixed | PROGRESS-TRAILER.md §3.1 event log, §3.4 |
| R1C-8 | 1 | C | should-fix | 0:03–0:09, 0:15–0:21 | The cards promise what the picture never shows | fixed | PROGRESS-TRAILER.md §2.3 cards |
| R1C-9 | 1 | C | should-fix | 0:04.5, 0:10.5, 0:19.5, 0:25.5 | Portrait wastes the frame | fixed | PROGRESS-TRAILER.md §2.1 |
| R1C-10 | 1 | C | should-fix | 0:03, 0:09, 0:15, 0:21 cards | Progress is never counted | fixed | PROGRESS-TRAILER.md §2.2 counters, PT7 |
| R1C-11 | 1 | C | must-fix | the whole video vs L2 | The authoring half is missing: no terminal, no time-lapse, no prompt | fixed | PROGRESS-TRAILER.md §2.2 authoring half, §3.3 |
| R1C-12 | 1 | C | should-fix | `progress/progress-video/tools/` vs L6,  | v1 forked the pipeline: its own `capture.mjs`, `cards.py` and `compose.py` (crossfade, loudnorm at −16) instead of `titles.mjs`, `mix.py` and `edit.mj | fixed | PROGRESS-TRAILER.md §3.1, §3.2 (v1 tools retired) |
| R1C-13 | 1 | C | should-fix | README step 5, S5 | Week 4 breaks the edit | fixed | PROGRESS-TRAILER.md §3.5 |
| R1C-14 | 1 | C | should-add | 0:27–0:29 end | "MMO" is never paid off | fixed | PROGRESS-TRAILER.md §2.2 grid fly-in |
