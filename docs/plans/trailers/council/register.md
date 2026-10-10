# TRAILERS Part B council — the register

One row per finding (or per merged group where the seats found the same thing). Seats' full tables:
`round-<n>-seat-<A|B|C>.md`. Status: `fixed` (commit) · `rejected` (reason) · `settled` · `parked` · `escalated`.

## Round 1 (2026-10-10) — A: 11 (6 must) · B: 25 (6 must) · C: 23 (6 must)

| ID | Sev | Where | Finding (merged) | Status |
|---|---|---|---|---|
| R1A-5 · R1B-1 · R1C-1 | must | shots 4–5 | the author walks and uploads the shard while it already sits in the grid; VISION stages it alone first | fixed — shots 3–5 staged alone; storyboard b04/b05 re-made |
| R1B-2 · R1A-5 | must | shot 5 | the nine beacons were a flat 3 × 3; VISION puts them at the cube's eight corners + centre | fixed differently — the ritual is cut (Jake 2026-10-09 "drop the upload ritual", MARKETING-SITE §7, R1C-new); shot 5 is the upload launch |
| R1A-6 · R1B-3 · R1C-2 | must | shots 1–7, 15 | the new shard changes in every frame; b07 / b15 show Driftwood where it should be | fixed — canonical `hero-shard.jpg`; b03 / b04 / b05 / b07 re-made from it; one neighbour map |
| R1B-4 · R1A-7 | must | references, shots 4–10 | Driftwood loses its toon facets under the shared aerial reference | fixed in the rules (references by role, reject non-toon Driftwood); draft-1 keyframes inherit it — re-check per take |
| R1A-3 · R1B-6 · R1C-5 | must | shot 3 (and light changes 5–7, 14) | grey→colour over time and lights switching on can't come from one look still; CT1 never tested them | fixed — draft 1 uses the half-grey keyframe; draft 2 two passes wiped in the edit; light changes get a re-roll then a cut |
| R1A-10 · R1C-3 · R1C-4 | must | the frame, shots 1–7 | muted on a phone the pitch doesn't read; the concept label is only on two cards; §0 still allows a hero slot | fixed — four captions, a corner label on every frame, the full line from frame 1; placement per ledger 7 |
| R1C-6 | must | shot 2 | Claude Code is never on screen; the monitor shows generated text | fixed — a cut to the real TR5 session recording |
| R1A-1 | must | shot 6 | not a runnable recipe | partly fixed — draft 1 runs it on CT1's grey dock blockout + a highway look still; the full job sheet comes with the blockout kit (CT3) |
| R1A-8 | must | CT5 | re-roll has no cap or fallback | fixed — one take + two re-rolls, diagnosis by failure kind, a stable insert after the cap |
| R1A-2 | should | shots 8, 10, 12 | gallop contradicts small-and-slow; shot 12 has several motions | fixed — walk; one motion; no hoverboard (staging-only, R1B-9) |
| R1A-4 | should | method | the directed route is a tested target, not exact geometry | fixed — wording + the keyframe gate |
| R1A-9 · R1B-6 | should | cost | timings understated (measured 12 / 8.4 min), no order or queue plan | fixed — measured times, critical-shots-first order, resumable job list |
| R1A-11 | should | frame, shot 15 | 1280 × 704 is not 16:9; shot 15 unbudgeted | fixed — the 1920 × 1080 crop rule; shot 15 generated |
| R1B-5 | should | §3.2 evidence | #9's look still was OpenAI; #10b's keyframe was a Qwen repaint of the grey, not of a capture | fixed — evidence column corrected |
| R1C (pull-out) | should | shot 14 | #9 loses detail by its last frames | fixed — push-in generated, played reversed |
| R1B-10 | should | end card | "Build it in Claude Code" with no upload API yet | settled — the pitch, labelled concept (MARKETING-SITE §1.1) |
| R1B (score prompt) | nit | concept-jobs.json | the cue's prompt still says "stitched together by light" | parked — music only, no picture |
| other nits / should-adds | — | various | wording, extra beats | parked; see the seats' files |

## Round 2 (2026-10-10) — A: 7 (4 must) · B: 14 (5 must) · C: 11 (4 must) — must-fix 18 → 8 (merged)

| ID | Sev | Where | Finding (merged) | Status |
|---|---|---|---|---|
| R2A-1 · R2B-2 · R2C-2 | must | shot 6 | draft 1 ran Layout-To-Render on CT1's lattice blockout (walls, beacon pillars, no roads) | fixed — `dock_blockout.py --highway` (roads, roundabouts, entries, the hero's four roads, a closer end) + a still painted from it |
| R2A-2 · R2B-3 | must | hero, shots 6–7 | the canonical hero has one road and no four entries | partly fixed — the blockout and the shot-6 still carry four roads; `hero-shard.jpg` re-made for draft 2 |
| R2A-3 · R2B-4 · R2C-1 | must | b01, b06, b15, the map | the hero fix stopped at four frames; the map contradicted its images | fixed — b01 = b07 emptied, b06 from the highway blockout + hero, b15 = a hold on b07; the map rewritten to b07; crossroads / drive placed elsewhere on the grid |
| R2A-4 · R2B-1 | must | TRAILERS §3.1, CT3–CT6, §5 | the plan's rows still described draft 2 (the ritual, old shots, seed re-roll, 1056) | fixed — rows rewritten to draft 4 |
| R2B-5 | must | draft-1 keyframes | the Qwen repaint failed the gate (night → day, neon lost) | fixed — atmosphere shots use the OpenAI frames; Qwen only repaints grey; the gate checks time of day and style |
| R2C-3 | must | shot 2 | the recorded session is another job and unreadable | fixed — removed from draft 1; draft 2 records a matching session |
| R2C-4 | must | shot 1 | the full label covers the hook | fixed — moved to the lower third |
| R2A-5 | should | production | not critical-first; a stale clip counts as done | fixed — order 6, 5, 7, 1 …; rejected clips are moved out by hand |
| R2A-6 · R2C-7 | should | shot 3 | the build's temporal change unproved | fixed — a wipe between the aligned stills |
| R2C-6 | should | captions | nothing says "built by players" after 32 s | fixed — caption 5 on shot 9 |
| R2C-8 | should | corner tag | too wide, unreadable on a phone | fixed — smaller |
| R2B-7, R2B-8, R2B-9, R2B-10 | should | rules, shot 14, state, board | push-in rule dropped; reversed water; state path; stale board | fixed — rule restored; b14 checked; scripts named; the board re-made with draft 1 |
| R2A-7 · R2C-5 · R2C-9 · R2C-10 | should | b07 beach, staging, the 5→6 bridge, crossroads map | Driftwood naturalistic in b07; staging changes sky; a hard space→world cut | parked for draft 2 (a toon re-make of b07's beach, one staging sky, a light-flash bridge) |
| R2B-6 | should | register IDs | round-1 seat-B IDs mis-cited, four rows missing | parked — the seat file is the source of truth |
