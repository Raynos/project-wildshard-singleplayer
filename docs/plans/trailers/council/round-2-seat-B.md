# TRAILERS Part B council, round 2, seat B: evidence and coverage (2026-10-10)

Lens: each register row checked against `git diff c481c9db7 0f8eaa85f` (ct2-script.md, TRAILERS.md) and its evidence:
the ledger, VISION.md, MARKETING-SITE §1/§7, the CT1 notes, `hero-shard.jpg` and b01–b15 (b07 cropped ×2), `look-grid-night`,
`shard-driftwood`, `board-storyboard.jpg`, CT1's grey blockout (frames 1 and 145) and `dock_blockout.py`, and draft 1's
production state as ct2 names it (scratchpad `ct2/draft1.sh`, `fix1.sh`, its Qwen keyframes `d1/q/b03–b05, b07`).

## Did each fix land

| Register row | Landed? |
|---|---|
| R1A-5 · R1B-1 staged alone | yes: text, b03 / b04 / b05 have no highway or neighbours |
| R1B-2 ritual cut | in ct2 only; TRAILERS §3.1 and CT3 still have the ritual and beacons (R2B-1) |
| R1A-6 · R1B-3 · R1C-2 one hero | hero-shard + b03 / b04 / b05 / b07 yes; b06 and b15 not re-made, b01 breaks the map, hero has no road entries (R2B-3, R2B-4) |
| R1B-4 Driftwood toon | rule yes; re-made b07 and untouched b08 still paint Driftwood naturalistic (R2B-5) |
| R1A-3 · R1B-6 · R1C-5 shot 3 | yes: atmosphere from the half-grey b03 (good), two passes for draft 2 |
| R1A-10 · R1C-3 · R1C-4 label, captions | yes in ct2; CT6 row still says "the typed prompt" (R2B-1) |
| R1C-6 real session | yes: `progress/trailers/tr5-lookout-session.cast` exists (asciinema v3, `claude --model sonnet`) |
| R1A-1 shot 6 recipe | the draft-1 recipe runs on CT1's lattice blockout (R2B-2) |
| R1A-8 cap · R1A-2 walk · R1A-4 | yes in ct2; CT5 row still "new seed" (R2B-1); b12 still shows a running figure (R2B-5) |
| R1A-9 cost · R1A-11 1080 | yes: 12 / 8.4 min match the 09 and 10b notes; 1280 × 1080 / 704 = 1963.6 → 1964, (1964 − 1920) / 2 = 22 ✓; CT6 still says 1056 |
| R1B-5 evidence · R1C pull-out · R1B-10 end card | yes; the reversed push-in has a side effect (R2B-8) |

## Findings

| ID | Sev | Location | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| R2B-1 | must-fix | TRAILERS §3 header, §3.1, §3.2 method, §3.3 CT2–CT6, §5 | The plan's rows (what the builder executes) still describe draft 2, against draft 3 in six places. | §3 "Draft 2 of the plan"; §3.1 "→ the nine-beacon upload ritual →"; CT3 "one blockout per directed shot (1, 3, 6, 7, 9, 14)" + "beacons" (ct2: directed = 1, 6, 9, 14, ritual cut); CT5 "weak takes re-rolled with a new seed" (ct2 Gates: one take + two re-rolls, diagnosis by kind, insert); CT6 "overlays (the typed prompt …)", "upscale to 1920 × 1056" (ct2: the real cast, four captions, 1080 crop); §5 "Keyframes by OpenAI Image 2.5 (his pick)" (ct2 atmosphere: Qwen; my R1B-17, never registered); §3.2 "an in-engine capture repainted" (ct2: "the storyboard frame or an in-engine view"). | Amend those lines to draft 3, each citing its register ID; §5 gets the 10-10 verdict (#9 / #10b) and the image model per kind of shot. |
| R2B-2 | must-fix | ct2 "Draft 1" paragraph, shot 6 | Draft 1's shot 6 runs Layout-To-Render on CT1's dock blockout, which is the **lattice** layout. Layout-To-Render follows the geometry, so it cannot give "its road entries meet the highway" or the hero's hill, river and waterfall. | `dock_blockout.py` l.6 "the lattice walls and the beacons glow", l.24 20 m cells, l.119 "the lattice: walls of light on every seam", l.131 emission ramps to 9.0 at the dock (a flare). Grey f1: a flat box with one cone tower; f145: a dense grid of small cells, no roundabouts, no entries, no empty plot. #9 melts the shard into the grid by f109 (R1B-5 evidence). | Draft 1: make shot 6 atmosphere from a re-made b06 (hero-shard as reference), or patch the blockout first (roads with corner roundabouts, one empty plot with four entry stubs, glow off, the hero's hill / river channel / tower, cut before the melt). Say which in ct2. |
| R2B-3 | must-fix | ct2 §The new shard, shots 6–7; hero-shard.jpg, b07 | The canonical hero shard has **no road entries**, yet shots 6 and 7 hinge on them and VISION requires them. | hero-shard: cliffs on all four sides, one cobbled path from the tower that ends at the waterfall lip. `fix1.sh` HERO prompt: "a stone road from the tower to the middle of the front edge" (one). b07 crop: rocks and pines line all four edges; no road joins the highway. VISION §The world: "at the midpoint of each of the four edges, a 15 m wide road … no wall or cliff may close an edge". Shot 7: "into the hero shard's four entries". | Re-make hero-shard with the cobbled road reaching all four edge midpoints (in staging they end at the cube's edge over the void), then b07 and b06 from it. Or re-word 6–7 to what the hero has. |
| R2B-4 | must-fix | ct2 §One neighbour map, shots 1, 8, 9, 15; b01, b08, b15 | The map fix did not land, and the written map contradicts its own source. | ct2: "Nalati north-west, Sky Reach north (as look-grid-night)", but look-grid-night and b07 have Nalati (yurts) **north** and Sky Reach **north-west**; b07's Dunes are SE, not E. b01 (shot 1): Dunes north of the plot, Driftwood east. b15 (not re-made): Driftwood in the centre cell, where the hero landed in shot 6 (the register claims "shots 1–7, 15"). Shot 8: Driftwood (S) and Nalati (N / NW) share no roundabout; b08 has Driftwood west of Nalati. Shot 9: Driftwood (S) and Pine (W) are diagonal and share no highway. | One top-down sheet in `art/trailers/round-2-highway/`, e.g. following b07: plot (0,0), Driftwood (0,−1), Pine (−1,−1), Dunes (1,−1), Nine Dragon (1,0), Nalati (0,1), Sky Reach (−1,1). Shot 8 becomes the plot's SW roundabout (the new shard, Driftwood, Pine, an unbuilt plot); shot 9 drives the Driftwood \| Pine edge. Re-make b01, b08, b15 to it. |
| R2B-5 | must-fix | ct2 Draft 1 + Gates; draft1.sh; d1/q | Draft 1's keyframes (running now) fail draft 3's own rules, and the gate cannot see two of the failures. | draft1.sh repaints b01–b15 with **one** prompt ("photoreal-leaning painterly lighting …") and no hero-shard or `shard-*` reference. `d1/q/b07.png`: shot 7's night becomes day, Nine Dragon loses its neon, no headlight streams. `d1/q/b04.png`: the hero shrinks to a rock with no hill or river. Inputs never re-made: b06 (square keep, two waterfalls), b08 (naturalistic Driftwood), b12 (a running figure), b15 (Driftwood centre). b07 was re-made with only look-grid-night as style (fix1.sh), so its Driftwood has smooth rocks against shard-driftwood's facets. | Per-shot Qwen prompts that state the time of day; references by role (hero-shard plus the `shard-*` in frame). Add "time of day as scripted" and "every shard in frame in its own style (Nine Dragon neon …)" to the keyframe gate. Re-make b06, b08, b12, b15 before their pass. |
| R2B-6 | should-fix | register.md; ct2 citations | Seat B's IDs are mis-mapped, and four of its findings have no row (COUNCIL §3: every finding gets an ID and a status). | Register "R1B-5" (§3.2 evidence) is R1B-7; "R1B-6" (cost) is R1B-10; "R1B-9" (hoverboard) is R1B-11; "R1B-10" (end card) is R1B-14. ct2 repeats them ("corrected, R1B-5/6", "R1B-9", "R1B-10", "(R1A-9, R1B-6)"), so R1B-5 is cited for two things. No rows for R1B-8 and R1B-17 (should-fix), R1B-20 or R1B-23. | Correct the IDs in the register and ct2. Add the four rows with a status. |
| R2B-7 | should-fix | ct2 Motion rules, Gates | Draft 3 dropped draft 2's "never the same slow push-in twice in a row", while adding push moves. | Draft 2: "4–6 s shots; never the same slow push-in twice in a row" (removed). Now shot 1 pushes down, shot 14 is a push-in, and the after-cap insert is "a slow push in the edit". #10b gave a slow push-down when prompted for a crane up and back (R1B-8). Shots 10–13 are four atmosphere shots in a row. | Restore the rule. Name a drift per atmosphere shot (10 truck, 11 pan, 12 crane up, 13 dolly). Make the insert's move differ from its neighbours'. |
| R2B-8 | should-fix | shot 14 | Played in reverse, everything that flows runs backwards. | The hero's waterfall (hero-shard), Sky Reach's falls (b12), the Dunes' fire smoke (b11), the cars. | Add a reverse check to 14's gate (no near waterfall, smoke or rain in frame), or frame them out of the blockout. |
| R2B-9 | should-fix | ct2 §Cost and order | "Production state lives in the scratchpad job list (`ct2/draft1.sh`)": a session scratchpad that the rules say to clean, so a successor cannot find it. | AGENTS.md / MACHINE.md: "Clean your scratchpad … What you keep goes in the repo". draft1.sh hard-codes this session's scratchpad path, and its prompts and seed (466) exist nowhere else. | Commit the job list (prompts, seeds, frames, `motion2.json`) under `scripts/steam-trailer/cinematic/` and cite that path. |
| R2B-10 | should-fix | art/trailers/round-2-highway: board, README | Jake's storyboard sheet is still draft 2. | `board-storyboard.jpg` last changed in c481c9db7: 05 "upload ritual" beacons, 07 "highway wakes" with Driftwood centre, old 03, 04, 06. The README doesn't list hero-shard.jpg and still calls look-crossroads "in-engine" (R1B-21). | Rebuild the sheet from the current b01–b15 with draft-3 labels. Add hero-shard to the README. |
| R2B-11 | nit | ct2 §Cost | "One pass of 14 shots": 15 are generated now (R1A-11). | Draft 3: 4 × 12 + 11 × 8.4 ≈ 140 min. Draft 1: 12 + 14 × 8.4 ≈ 130 min. | Write "15 shots"; the range holds. |
| R2B-12 | nit | ct2 shots 2, 4 | The author's look is undefined (battery 6): a modern person at a desk, then a cloaked figure. | b02 vs b04. | One line: "the author walks as their avatar (b04's cloak)", and use b04 as the reference. |
| R2B-13 | nit | shots 3–5 | The staging space jumps: deep space with galaxies (hero-shard, b03, b05), then a golden sea of clouds (b04). | The images. | Pick one, or say the light changes. |
| R2B-14 | nit | ct2 §No upload ritual | The cut rests on Jake's first read of the *site*; MARKETING-SITE §7 Q1 ("the upload itself is the nine-beacon ritual") and the ledger given still keep it. | MARKETING-SITE §7, ledger givens. | Register: "the site's call applied to the trailer", visible to Jake when he reads the draft. |

## Battery (draft 3)

1. **Shot 6 end to end: fail.** The recipe is in a scratchpad script, not the doc. Its blockout is the lattice (R2B-2), the hero
   has no entries (R2B-3), and there is no done-when.
2. **Shot 10, Nalati: partial.** Qwen on b10, then LTX. The prompt is generic and passes no `shard-nalati` reference (R2B-5).
   Limb failures → smaller, slower figures ✓. No capture named (R1B-23, unregistered).
3. **Ledger on every shot: partial.** Highway ✓ on the boards; shot 6's geometry is the lattice (R2B-2). Own style ✗: b07,
   b08, Qwen b07 (R2B-5). Figures ✗ in b12. Text ✓. Label ✓.
4. **Busy lock: pass.** Measured times, critical-first order, resumable list (the scratchpad caveat is R2B-9).
5. **Bad take: pass.** Cap, diagnosis by kind, insert. The insert's push clashes with R2B-7.
6. **Continuity: fail.** The map contradicts its images and two shots (R2B-4). The hero's entries are missing (R2B-3). The author
   and the void are undefined (R2B-12, R2B-13).
7. **Phone, muted: pass.** Four captions, the corner tag on every frame, the full line from frame 1, the end card.
8. **Jake opens the draft: partial.** b01 is strong and labelled, but it pushes down and breaks the map; his sheet is stale
   (R2B-10).

Verdict: Round 1's fixes landed in ct2's text but not in what gets built: the plan's rows still describe draft 2, draft 1's shot 6 runs on the lattice blockout, the canonical hero has no road entries, the map contradicts its own images, and draft 1's keyframes fail the draft's own gate.
