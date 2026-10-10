# Ledger: the progress trailer council (E468)

Frozen. A seat reopens a row only with new evidence (file and line, a quote, a source) that it is wrong.

| # | Settled | Source |
|---|---|---|
| L1 | Jake on v1: *"It's a start but it's shit it's not epic it doesn't have real gameplay."* | E468, 2026-10-09 |
| L2 | *"It should be half gameplay in first person of the game. It should be half shard authoring which means timelapse or progress of a shard over time."* | E468 |
| L3 | It is a **progress** trailer: the game being built over time, "building your first MMO: day one, week one, week two, week three" (the repo's day 1 = 16 Sep 2026, `568a1463f`; day 8, 15, 22 = `2d2c5815a`, `19a434635`, `c9aaa62ab`, the last commit on main's first-parent line each day; reopened in round 4 with evidence: v1's `8a58b9d1e` was the nalati-grasslands branch tip, R4B-3). | E467, 2026-10-09 |
| L4 | **Format is open**, not settled: *"Maybe it should be landscape maybe it should be desktop."* The council recommends; Jake picks with the question tool. | E468 |
| L5 | Everything shown is real: real 3D from a real build at a named SHA, no screenshot cheats, no retouching; the HUD may be hidden. | AGENTS.md (Jake), TRAILERS §2.1, MARKETING-SITE §1.1 |
| L6 | The **alpha trailer** (TRAILERS Part A, 63 s, 16:9, shipped on wildshard.io, `55d4cc841`) and its pipeline `scripts/steam-trailer/` (shots as code, player-input or spline rigs, fixed-step 4K / 120 Hz capture, titles, MiniMax score, −14 LUFS mix, 1080p60 conform) belong to the TRAILERS plan and its trailer agent. The progress trailer reuses that pipeline; it does not fork or duplicate it, and it does not take TRAILERS' rows (TR9, CT1–CT4). | docs/plans/TRAILERS.md |
| L7 | Music is MiniMax Music 3; every SFX is MOSS-SoundEffect v2 and Stable Audio 3 Medium, the better take ships. One local model at a time, under the model lock. | AGENTS.md |
| L8 | Machine: at most 4 game browsers (every capture through `scripts/browser-lane.sh`), one app build machine-wide (`scripts/heavy-lane.py build`), no vite dev servers, muted test browsers. | AGENTS.md, docs/process/MACHINE.md |
| L9 | Jake plays on an iPhone 17 Pro, portrait; every screenshot sent to him is iPhone portrait. (This governs screenshots and boards, not necessarily the trailer's master format: see L4.) | AGENTS.md |
| L10 | Each shard keeps its own style (Driftwood low-poly toon, Nalati painterly, Pine Hollow photoreal PBR, …). | AGENTS.md |
| L11 | **Jake's picks (PT0)**: 16:9 only, a 1920 × 1080 / 60 fps master; 60 s. No 9:16 cut. | question tool, 2026-10-09 |
| L12 | The trailer agent's hooks landed in `64c6d84f0`: `capture.mjs --shots-file`, `cut.mjs --cut-file`, InputService held movement in `lib.mjs`, real sub-steps (`--sub 2` = 1/120 s). | herdr, 2026-10-09 |
