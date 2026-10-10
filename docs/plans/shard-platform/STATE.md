# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-10 06:50 CT.** Councils done. Part A only.

**Milestones**
- **M1:** done.
- **M2:**
  - **SF22 desktop:** PASS on a quiet machine (`d393dc95b`, 5ee864810). 6/6 crossings, max 30.1 ms, 0 GL faults (GL1281 fixed), 0 draw compiles.
  - **SF22 Safari:** install PASS; cadence FAIL (p95 47 / p99 68, 18 draw/driver compiles left; clean run 9df2b3e3e; sp-x5 wires offscreen PMREM variants).
  - **Memory:** G269.
- **M3:** open. Pine, Driftwood and Nalati runtime still exceeds the 20 % cap.

**Live:** production `7f51e883a`.

**Shares (old public/custom measure; G291 replaces it: custom runtime TS ≤ 20 % of the frozen legacy folder, sp-x2 rewriting the metric per G291 + G294, report-only first)**

| Shard | Share |
|---|---|
| Template | 95.5 % |
| Fixtures | 95.7 % |
| Nine | 70.8 % |
| Signal | 64.1 % |
| Sky | 45.8 % |
| Pine | 24.5 % |
| Driftwood | 19.1 % |
| Nalati | 14.1 % |

The metric now counts local `.json` imports (`64559e6b1`).

**Lanes (Jake G289: 2 Opus + 5 Codex)**

Opus: two lanes, graphics/UI only.

| Lane | Work |
|---|---|
| op-sky88 | Sky view code → generators + data rows (no isles) |
| op-look19 | SF19b: each shard's look under one frame (G94/G95/G96) |

Codex, each queued three deep:

| Lane | Queue |
|---|---|
| sp-x1 | Nalati elites → species / AS brains · Nalati witness → compatible · SF24 Nalati events |
| sp-x2 | G291 metric in shard-platform.mjs · Antler King → the boss system |
| sp-x4 | Driftwood creatures → species brains · Driftwood quests · SF24 Driftwood finale |
| sp-x5 | SF22 Safari cadence · SF75 telemetry · SF58 hardening |
| sp-x6 | SF30 movers done (566779cf3) · SF34 template modes landing · Sky flock keeper → species homes |

sp-x3 is an idle retired pane with no work assigned.

**Platform systems shipped tonight (SF27, for every shard)**
- species-row brains;
- AS script brains;
- phased-flyer / phased-raptor;
- marked and held boss fights;
- lash host;
- quest runtime and pivot NPC;
- marked-boss presentation;
- rows-built headless runtime.

**Rows:** SF36 done · SF59 done · SF34 engine done · SF63 parity done · SF22 desktop PASS.

**Decisions:**
- G290–G295: outputs generated from in-repo SDK TS (build-time + cache; commit only small expensive ones, Blender GLBs stay); 80/20 = custom runtime ≤ 20 % of legacy; a system is public only with 2+ shards; data rows → generic SDK → AS → runtime TS. Audit flags: cec76797f wind-stooper (Nalati-only).
- Bakes are cost-gated (shrine / shipwreck refused, Nalati dressing plan refused, kurgan interior refused).
- SF22 cadence counts within one 0.1 ms quantum; warm-up compiles count only if their task exceeds 50 ms.

**Jake**
- **SF67:** create the AudioContext on first tap? Pick.
- **SF63:** Driftwood grid shadows "Tight", +25 MB. Pick.
- **Sky isles:** random per session; baking unblocks Sky's biggest bake. Pick.
- **SF59:** fixture looks (taste).
- **G269:** phone runs.
- **G260:** Blender board.
- **Public Pine / Nalati:** flip them off the legacy copies.
