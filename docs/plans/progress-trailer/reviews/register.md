# Register: the progress trailer council (E468)

Every finding, across rounds. Status: `fixed` + commit · `rejected` + reason · `settled` · `parked` · `escalated`.

| ID | Round | Seat | Severity | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| R1A-1 | 1 | A | must-fix | 0–3 s | The title establishes a progress story, but the opening offers no action or visible transformation to earn another three seconds. | fixed | PROGRESS-TRAILER.md §2.2 cold open |
| R1A-2 | 1 | A | must-fix | 3–9, 15–20, 24–26 s | Eye-height camera movement is not first-person play; v1 supplies neither half of L2. | fixed | PROGRESS-TRAILER.md §2.3, PT3 |
| R1A-3 | 1 | A | must-fix | Capture recipe / S3 | The Steam capture cannot simply point at every historical build | fixed | PROGRESS-TRAILER.md §3.1 era adapters |
| R1A-4 | 1 | A | must-fix | Capture timing | Current default subframe timing disagrees with the “120 Hz” promise: two samples advance two 1/60 simulation steps for each 1/60 output frame | fixed | PROGRESS-TRAILER.md §3.2 (sub-steps fixed by the trailer agent in 64c6d84f0) |
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
| R2B-1 | 2 | B | must-fix | §2.2 0:03–0:07, §3.3 "Day 1" | `progress/001…050` is not day 1 and not a sequence | fixed | PROGRESS-TRAILER.md §2.2 0:03.6 (21 stills by commit time, compressed clock) |
| R2B-2 | 2 | B | must-fix | §2.2 0:00 card, 0:57 end card, §2.3 Rece | "Day 23" contradicts "23 days ago" | fixed | PROGRESS-TRAILER.md §2.2 cold-open card + end card, §2.3 dayOf |
| R2B-3 | 2 | B | should-fix | §2.2 end card "6 shards", PT7 | "6 shards from git" has no definition | fixed | PROGRESS-TRAILER.md §2.3 shards = SHARDS slugs, PT7 test |
| R2B-4 | 2 | B | must-fix | §3.2 "Titles … run unchanged", PT7, S8 | The shared titles cannot render this trailer's cards | fixed | PROGRESS-TRAILER.md §3.2 titles.mjs --titles-html request, PT7 |
| R2B-5 | 2 | B | must-fix | §2.2 0:51–0:54, PT3 | The rewind moment cannot be shot as written | fixed | PROGRESS-TRAILER.md §2.2 rewind (four takes, three cuts, d22 stag), §2.3 slow motion, PT3 |
| R2B-6 | 2 | B | should-fix | PT2 "(0, −236), spawn 'unchanged from v1 | Wrong coordinate and wrong source | fixed | PROGRESS-TRAILER.md PT2 (b) start poses cited |
| R2B-7 | 2 | B | should-fix | §3.1 "frame check against that era's nea | Day 1 and day 8 have no such capture | fixed | PROGRESS-TRAILER.md §3.1 reference frames per era + decide.sh qa |
| R2B-8 | 2 | B | should-fix | §3.3 lapses vs §3.1 adapters, PT1, PT5 | The ~25 lapse SHAs have no adapter, and PT1 proves only the four chapter SHAs | fixed | PROGRESS-TRAILER.md §3.1 lapse camera adapter, PT2 (c), §2.2 lapse windows |
| R2B-9 | 2 | B | must-fix | §2.2 0:25 "Nine Dragon Stack from grey t | There is no grey stage | fixed | PROGRESS-TRAILER.md §2.2 0:22.6 (partial square → full stack; fallback Pine remaster) |
| R2B-10 | 2 | B | should-fix | §2.2 0:37–0:51 Sky Reach → play hand-off | (a) The "windmill view" faces away from the bridge | fixed | PROGRESS-TRAILER.md §2.2 0:32 (spawn view, re-render, last stage c9aaa62ab), §2.3 spans |
| R2B-11 | 2 | B | should-fix | PT6, §2.3 honest authoring | (a) TR5's session is "a real session adding a lookout tower to Sky Reach" | fixed | PROGRESS-TRAILER.md §2.3 honest authoring, PT6 |
| R2B-12 | 2 | B | should-fix | PT5 done-when vs §2.2 | "Each lapse plays 6–8 s with a moving camera" fails for two of the four lapses | fixed | PROGRESS-TRAILER.md PT5 per-lapse done-whens |
| R2B-13 | 2 | B | should-fix | §3.1 capture context | No viewport, tier or URL params are named for historical takes | fixed | PROGRESS-TRAILER.md §3.1 capture context |
| R2B-14 | 2 | B | should-fix | §2.2 0:00–0:03, S1 | The cold-open card has no time | fixed | PROGRESS-TRAILER.md §2.2 0:00–0:03.6 timings |
| R2B-15 | 2 | B | nit | §1, §2.2 0:00 | (a) "The alpha trailer … (sword combo, horseback archery, grapple, whip)": `cuts/alpha.mjs` has `d-combo` and `n-archer`, but no grapple or whip shot | fixed | PROGRESS-TRAILER.md §1, §2.2 cold-open source |
| R2B-16 | 2 | B | nit | §2.2 0:13 "days 2–8 … 18–23 Sep"; 0:25 " | Driftwood's first commit (18 Sep 01:29) is day 3 on L3's calendar | fixed | PROGRESS-TRAILER.md §2.2 computed captions, PT4 reworded, register R1A-4 note |
| R2B-17 | 2 | B | nit | §3.1 receipts, PT9 | `edit.mjs` takes either `<shot>/meta.json {sub, shard}` + `%06d.jpg` frames (graded per shard) or a finished `video` clip (ungraded) | fixed | PROGRESS-TRAILER.md §3.1 edit.mjs frame format |
| R2C-1 | 2 | C | must-fix | §2.2 0:51–0:54, §3.1 | The rewind moment can't happen at real speed | fixed | PROGRESS-TRAILER.md §3.1 speed/sub, §2.2 rewind 4.5 s, §2.3 |
| R2C-2 | 2 | C | must-fix | §2.2 rewind, PT2–PT3 | "The same camera" is never defined, so the bolt won't read as continuous | fixed | PROGRESS-TRAILER.md PT3 (one input track, hip-fire, bolt-distance cuts), PT2 (b) eye < 0.1 m |
| R2C-3 | 2 | C | must-fix | §2.2 0:51 "lands in today's forest" | The climax hits nothing | fixed | PROGRESS-TRAILER.md §2.2 rewind (d22 stag), PT3 |
| R2C-4 | 2 | C | must-fix | §2.2 0:03–0:07, §3.3 "Day 1" | The day-1 stills beat is false against its own clock | fixed | PROGRESS-TRAILER.md §2.2 0:03.6 |
| R2C-5 | 2 | C | should-fix | §2.2 0:00–0:03 | The cold open has no room to read | fixed | PROGRESS-TRAILER.md §2.2 0:00–0:03.6 |
| R2C-6 | 2 | C | should-fix | §2.2 pacing | Metronome, not escalation | fixed | PROGRESS-TRAILER.md §2.1 escalation |
| R2C-7 | 2 | C | should-fix | §2.2 0:31–0:37 | "Then the remastered Pine hunt" is the third Pine crossbow hunt (with day 1 and the rewind) | fixed | PROGRESS-TRAILER.md §2.2 week 2 Nine Dragon only |
| R2C-8 | 2 | C | should-fix | §2.2 0:45–0:51 | "Step onto the windmill bridge" is a walk, v1's dolly under another name | fixed | PROGRESS-TRAILER.md §2.2 week 3 hover + gust, PT2 (a) |
| R2C-9 | 2 | C | must-fix | §2.2 0:37–0:45, §3.3 Sky Reach | The Sky Reach lapse as written is a pillarboxed HUD slideshow with a broken match cut | fixed | PROGRESS-TRAILER.md §2.2 0:32, §3.3 |
| R2C-10 | 2 | C | should-fix | §3.3 all lapses | The lapses will flicker, not grow | fixed | PROGRESS-TRAILER.md §3.3 |
| R2C-11 | 2 | C | should-fix | §2.2 author half | Nothing makes a lapse read as authoring rather than one more flyover | fixed | PROGRESS-TRAILER.md §2.1 authoring frame + rail, §3.2 |
| R2C-12 | 2 | C | should-fix | §2.2 0:54–0:57, PT6 | The Claude Code beat deflates the climax | fixed | PROGRESS-TRAILER.md §2.2 0:45 the breath, PT6 |
| R2C-13 | 2 | C | should-fix | §3.4 SFX | "Every SFX generated with MOSS + SA3" ignores what exists and erases a progress cue | fixed | PROGRESS-TRAILER.md §3.4 era-true SFX |
| R2C-14 | 2 | C | should-fix | §3.4 music | The cue is vague, collides with the beat sheet, and copies the alpha | fixed | PROGRESS-TRAILER.md §3.4 additive cue at 120 bpm |
| R2C-15 | 2 | C | should-fix | §2.2 0:57–1:00 end | The end sells nothing | fixed | PROGRESS-TRAILER.md §2.2 0:52.5–1:00 |
| R2C-16 | 2 | C | should-fix | §3.1 vs §3.3 | The lapses need what the adapters don't give: a free camera in each era, and each SHA's entry URL | fixed | PROGRESS-TRAILER.md §3.1 lapse adapter, §2.2 lapse windows |
| R2C-17 | 2 | C | should-fix | §3.1, PT9 | Grade and size of the historical takes are unstated | fixed | PROGRESS-TRAILER.md §2.3 era-true grade null, §3.1 4K frames |
| R2C-18 | 2 | C | should-fix | §2.1, PT7 | Legibility on the phone | fixed | PROGRESS-TRAILER.md §2.3 legibility rule |
| R2C-19 | 2 | C | should-fix | §2.3 vs the reused alpha shots | Is the alpha's Matriarch shot "real play"? It sets `stage('waymarks-lit')`, calls `matriarch.arm()`, teleports with `tp()` and steers yaw toward the b | fixed | PROGRESS-TRAILER.md §2.3 allowed start conditions |
| R2C-20 | 2 | C | should-fix | §3.5 | "The newest chapter takes the drop slot" contradicts §2.2: the drop is the rewind, which holds every chapter | fixed | PROGRESS-TRAILER.md §3.5 |
| R2C-21 | 2 | C | nit | §2.1 "exactly half" | The grid reveal is counted as authoring but isn't authoring | fixed | PROGRESS-TRAILER.md §2.1 about half |
| R2A | 2 | A | — | — | Seat A (Codex) hit its 60 min timeout without writing a file | — | its lens (the era adapters) was proven by PT1's takes; Codex sits in round 3 |
| R3A-1 | 3 | A | should-fix | §3.1 frame check; PT2–PT3 | The defined QA cannot ask the stated question or certify a standing eye | fixed | PROGRESS-TRAILER.md §3.1 "Checked" (two steps) |
| R3A-2 | 3 | A | should-fix | §2.2 cold-open/terminal; §2.3 legibility | The new universal reading limit conflicts with the prescribed content, so PT6/PT7 must choose which rule to violate. | fixed | PROGRESS-TRAILER.md §2.3 per-block legibility, §2.2 card/breath/end cards |
| R3A-3 | 3 | A | should-fix | §3.5; PT11 | The week-4 recipe gives no executable allocation of the 60 s budget after adding both a play beat and a lapse | fixed | PROGRESS-TRAILER.md §3.5 seconds order, PT11 |
| R3A-4 | 3 | A | must-fix | §2.2 Sky Reach; §3.3 camera speed; PT5 | The named overview-to-spawn crane cannot reach the promised match cut in eight seconds at ≤3 m/s. | fixed | PROGRESS-TRAILER.md §2.2 0:32, §3.3 near-spawn crane |
| R3B-1 | 3 | B | must-fix | §3.1 "Reference frames per era" (R2B-7's | The check can't do what it says, so R1B-1's bare plain passes it | fixed | PROGRESS-TRAILER.md §3.1 "Checked", honest references |
| R3B-2 | 3 | B | should-fix | §2.2 0:11.6 "counter 29 → 624", 0:22.6 " | The counter is "computed per SHA", but its range is the chapters' | fixed | PROGRESS-TRAILER.md §2.3 counter per stage, §2.2 counts, PT7 |
| R3B-3 | 3 | B | should-fix | §2.1 "every boundary snaps to the cue's  | §2.2's times aren't on a 120 bpm grid | fixed | PROGRESS-TRAILER.md §2.2 re-timed on bars, §2.1 |
| R3B-4 | 3 | B | should-fix | §2.2 0:48–0:52.5; §3.5 "≈ 0.6 s"; PT2 (b | The rewind's slow motion isn't tied to the stag's distance | fixed | PROGRESS-TRAILER.md §2.2 rewind speed ramp, PT3 done-when |
| R3B-5 | 3 | B | should-fix | §2.1 authoring frame vs §2.2 0:32 "final | The diff added a contradiction: the Sky Reach hand-off can't match-cut | fixed | PROGRESS-TRAILER.md §2.2 0:32 inset grows to full-bleed, §3.3 lapse renderer |
| R3B-6 | 3 | B | should-fix | §2.2 0:45 "≤ 12 words", §2.3 "never a di | TR5's own prompt can't be shown under these rules | fixed | PROGRESS-TRAILER.md §2.2 0:44 breath (day-1 line), PT6 |
| R3B-7 | 3 | B | should-fix | §2.2 0:52.5 "Every shard … every cell in | (a) `g-reveal` doesn't show every cell, or every shard | fixed | PROGRESS-TRAILER.md §2.2 0:52 "one world", §2.3 shard rule |
| R3B-8 | 3 | B | should-fix | §2.2 0:03.6 day-1 stills | "Each appearing at its commit's moment" breaks on the real times | fixed | PROGRESS-TRAILER.md §2.2 0:04 wall |
| R3B-9 | 3 | B | should-fix | §2.1 "week 3 four of ~1.2 s"; §2.2 0:40  | Four shots, three named: the hover off the edge, a gust, the whip. | fixed | PROGRESS-TRAILER.md §2.2 0:40 week 3 named |
| R3B-10 | 3 | B | nit | §2.2 totals | "Play ≈ 29 s, cards and close ≈ 6 s" are wrong | fixed | PROGRESS-TRAILER.md §2.2 totals |
| R3B-11 | 3 | B | nit | §2.2 end card; §2.1 lapses | (a) "Day N · week N+1" reuses N | fixed | PROGRESS-TRAILER.md §2.2 end cards, §3.5 week rule, §2.1 |
| R3B-12 | 3 | B | nit | §2.3 era-true, PT9; §2.2 0:32 | (a) `grade: 'null'` works only by fall-through: `GRADES['null']` is undefined, then `?? 'null'` | fixed | PROGRESS-TRAILER.md §2.3 grade none (evidence `403bd7c57`, edit.mjs:35), 6066f959c |
| R3C-1 | 3 | C | must-fix | §2.1 "every boundary snaps to the cue's  | The sheet is off its own grid | fixed | PROGRESS-TRAILER.md §2.2 re-timed on bars |
| R3C-2 | 3 | C | must-fix | §2.2 0:48 rewind, §3.5 "≈ 0.6 s per segm | As specced, the rewind doesn't read | fixed | PROGRESS-TRAILER.md §2.2 rewind ramp, PT2/PT3 |
| R3C-3 | 3 | C | must-fix | §2.1 authoring frame × §2.2 0:32 "final  | The inset breaks the match cut that R2C-9 fixed | fixed | PROGRESS-TRAILER.md §2.2 0:32, §3.3 |
| R3C-4 | 3 | C | should-fix | §3.4 additive cue, "four seeds … ±0.25 s | A MiniMax prompt cannot be trusted to bring in a music box, then strings at bar 9, then percussion at bar 14 | fixed | PROGRESS-TRAILER.md §3.4 stems |
| R3C-5 | 3 | C | should-fix | §2.2 0:48 "on the drop" vs §3.4 "the dro | The two sections place the drop at different times | fixed | PROGRESS-TRAILER.md §3.4 the climax in sound |
| R3C-6 | 3 | C | should-fix | §2.2 0:45 breath, PT6 | Neither PT6 source fits the slot | fixed | PROGRESS-TRAILER.md §2.2 0:44, PT6 |
| R3C-7 | 3 | C | should-fix | §2.1 frame, §3.3 "≤ 48 characters … in t | The authoring frame risks reading as a slide deck, and its numbers clash | fixed | PROGRESS-TRAILER.md §2.1 band + real-rate rail, §3.3 |
| R3C-8 | 3 | C | should-fix | §2.2 0:03.6 day-1 stills, PT5 | On the commit clock, the 21 stills come out as dead air followed by a strobe | fixed | PROGRESS-TRAILER.md §2.2 0:04 wall |
| R3C-9 | 3 | C | should-fix | §2.1 escalation, §2.2 0:40 week 3 | The escalation starves the best footage | fixed | PROGRESS-TRAILER.md §2.1, §2.2 0:40 earned hold |
| R3C-10 | 3 | C | should-fix | PT2 (b), §2.3 honest | "Not worse" is not the same as "better" | fixed | PROGRESS-TRAILER.md PT2 (visibly better), §3.1 Checked |
| R3C-11 | 3 | C | should-fix | §3.5 week 4 | Adding a chapter costs about 10 s (a play beat plus a lapse) | fixed | PROGRESS-TRAILER.md §3.5 |
| R3C-12 | 3 | C | should-fix | §2.2 0:54.3 end card, §2.3 "≤ 7 words" | The end card runs 13 words in one card, and 7.5 s of grid plus static card follow the climax. | fixed | PROGRESS-TRAILER.md §2.2 0:54 two cards |
| R3C-13 | 3 | C | nit | §2.2 0:40 | "Four shots" lists three verbs, and "a gust" is unnamed. | fixed | PROGRESS-TRAILER.md §2.2 0:40 |
| R3C-14 | 3 | C | nit | §2.2 totals line | The sheet sums to play 26.1, authoring 25 and cards/close 8.9, not 29 / 25 / 6. | fixed | PROGRESS-TRAILER.md §2.2 totals |
| R3C-15 | 3 | C | nit | §2.2 0:00 cold open, S12 | The share thumbnail is a shot already published in the Nine Dragon teaser. | fixed | PROGRESS-TRAILER.md §2.2 0:00 new start pose |
| R4A-1 | 4 | A | should-fix | §2.1; §2.2 0:46–0:52; §3.1; PT3 | The new rewind specifies distances and an approximate speed, but not a timing map that satisfies its beat-grid and impact constraints | fixed | PROGRESS-TRAILER.md §2.2 rewind (ramp tool, frame 3,000, cuts follow the bolt), §3.1 --ramp |
| R4A-2 | 4 | A | should-fix | §3.5; PT11 | The week-4 order supplies 12 seconds of savings, but calls the added chapter about 10 seconds and never allocates its play/lapse durations | fixed | PROGRESS-TRAILER.md §3.5 12 s chapter + worked EDL |
| R4A-3 | 4 | A | should-fix | §3.4; PT8 | The new stem fix does not supply the named instrument controls: htdemucs cannot independently unmute strings while keeping melody alone underneath day | fixed | PROGRESS-TRAILER.md §3.4 four-stem arrangement |
| R4B-1 | 4 | B | should-fix | §2.2 0:46 rewind ramp vs §3.1 "0.25× for | The diff specs a speed ramp (1× → ≈0.05× → 1×), but §3.1 still says 0.25× | fixed | PROGRESS-TRAILER.md §3.1 --ramp landed in take.mjs, §2.2 |
| R4B-2 | 4 | B | should-fix | §3.4 "melody alone… + bass and strings…  | htdemucs splits into drums / bass / other / vocals | fixed | PROGRESS-TRAILER.md §3.4 other → bass → drums, music_stems.py |
| R4B-3 | 4 | B | should-fix | §3.1 "day 8, the numbered stills committ | I can't reproduce 62 | fixed | PROGRESS-TRAILER.md §0 + ledger L3: day 8 = 2d2c5815a (main); §3.1 day-8 references |
| R4B-4 | 4 | B | should-fix | §3.1 "Learned in PT2's first probe", "+1 | These are stated as measurements, but their receipts went to scratch (`take.mjs --out=<scratch>`) | fixed | PROGRESS-TRAILER.md progress/progress-trailer/pt2-probe/ receipts, §3.1 |
| R4B-5 | 4 | B | should-fix | §3.5 seconds order, PT11 "exactly 3,600  | A chapter on week 3's pattern costs 8 s (the newest lapse keeps the showpiece) + 4 s of play = 12 s, not ~10, and the rewind gains a fifth segment (≈  | fixed | PROGRESS-TRAILER.md §3.5 12 s order + rewind fixed 6 s |
| R4B-6 | 4 | B | nit | §2.2 0:54 end card "Day 24 · 7,0xx commi | HEAD on day 24 already has 7,115 commits (`git rev-list --count 57a256a96`). | fixed | PROGRESS-TRAILER.md §2.2 end card computed |
| R4B-7 | 4 | B | nit | §2.2 0:04 wall | "At its commit's moment" and "each held ≥ 4 frames" collide: three commit pairs land < 4 frames apart on the compressed clock (23:02:23 → 23:03:14 is  | fixed | PROGRESS-TRAILER.md §2.2 wall tile timing |
| R4B-8 | 4 | B | nit | §2.2 0:44 breath | "Appears as the `+` line it was", but the `+` line runs 60+ words: the 7 shown are an excerpt, and "keyclicks" means it is typed, not that it appears. | fixed | PROGRESS-TRAILER.md §2.2 breath typed excerpt |
| R4B-9 | 4 | B | nit | §2.2 0:32 Sky Reach | "In its first 43 hours" now titles the whole beat, but its last stage is `c9aaa62ab` (7 Oct, 4 days later) | fixed | PROGRESS-TRAILER.md §2.2 Sky Reach band |
| R4B-10 | 4 | B | nit | §2.1 escalation; register | Weeks 1 and 2 are both 2 s shots, not "shorter each chapter"; 0:07 sits mid-bar (on the beat grid, but the register says "on bars") | fixed | PROGRESS-TRAILER.md §2.1 wording; register R3B-12 note |
| R4C-1 | 4 | C | must-fix | §2.1 "week 3 two ~1 s cuts and then an e | The match cut's payoff is a ~1 s shot that can't do what it says | settled | PROGRESS-TRAILER.md §2.2 week 3 hover as the earned hold (Jake picked it, 2026-10-09) |
| R4C-2 | 4 | C | must-fix | §2.2 0:46 rewind, §3.1 capture context,  | Days 8, 15 and 22 draw the bolt as a debug tracer | fixed | PROGRESS-TRAILER.md §2.3 tracers off, §2.2 rewind |
| R4C-3 | 4 | C | should-fix → Jake decision | §2.2 rewind "the crossbow model changes  | Git predicts two of the three cuts show almost nothing new at Pine Hollow | settled | PROGRESS-TRAILER.md §2.2 rewind cut rule + fallback (Jake picked it, 2026-10-09) |
| R4C-4 | 4 | C | should-fix | §2.2 every play row, §2.1 "Play is alway | "Week 1 / 2 / 3", the film's spine (L3), never appears on screen, so §3.5 computes a week that nothing displays | fixed | PROGRESS-TRAILER.md §2.2 chapter labels in the bands |
| R4C-5 | 4 | C | should-fix | §2.2 0:32 "Sky Reach in its first 43 hou | The diff dropped round 3's "the last stage carries its own date" | fixed | PROGRESS-TRAILER.md §2.2 Sky Reach band |
| R4C-6 | 4 | C | should-fix | §3.4 "the four ambient beds … swap at ea | Days 1 and 8 have an ambient bed, but the plan gives no source for it | fixed | PROGRESS-TRAILER.md §3.4 day-1/8 beds recorded from the served build |
| R4C-8 | 4 | C | nit | §2.2 0:46 speed ramp vs §2.1 "every boun | At ≈ 0.05×, the cuts at 2 / 4 / 6 m fall 0.645 s apart (2 m ÷ 62 m/s ÷ 0.05), which is off the 0.5 s beat. | fixed | PROGRESS-TRAILER.md §2.2 cue out, cuts follow the bolt |
| R4C-9 | 4 | C | nit | §2.2 0:54 end cards | The cards' background isn't given, so the executor will guess black | fixed | PROGRESS-TRAILER.md §2.2 grid under the end cards, computed count |
| R4C-7 | 4 | C | nit → Jake (taste) | §2.2 0:44 breath, PT6 | Cutting "for building" changes the meaning of the day-1 line | settled | PROGRESS-TRAILER.md §2.2 breath "claude code as the UI for building" (Jake picked it, 2026-10-09) |
