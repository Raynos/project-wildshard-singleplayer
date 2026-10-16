# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**Order (G450–G452):** rewire now (P0–P4, W2a/W2b) → W2 closes 05:00Z 10-17 → W1 spike (Sky/Signal ≤ 10 % on the output ruler; rows KA1–KA7, KS1–KS6, KR1, KP1, KT2 in open-x-queue, G457) → W3. Never pause lanes; Codex lanes out of W2 work run KA1–KA4 now.
**G453:** sim never in runtime/; custom sections shrink-only; no v1 back-compat. **G454:** 5-test host bar, data-only host APIs, Opus host review at wave close. **G456:** Opus 5 until 60 % weekly (35 % at 13:17Z).

**Plan % (G458, outcome-only) at 14:10Z `8324f5ae1`: M3 = 18.0 %** (14,406 of 80,172 must-go lines cut; source ruler, Nalati clamped at 0: it sits 4 % above legacy). **M2 not yet measured:** no per-shard grid-ready verdict exists. x7 adds M3 + grid-ready columns + a plan % line to the P4 report. Until then, plan = 10.8 % + 40 % × M2.
Per shard, custom vs legacy: Pine 85.7 %, DW 79.8 %, Sky 89.5 %, Signal 43.6 %, Nine 77.0 %, Nalati 104.5 %.

**Since 14:10Z:**
- T1 Template on the source layout `eda831648`
- catalog orchestration + copyRuntime `1a6984b0a`
- Pine 13 sections `9058fc70e`
- H1 closed (`51193fc82`, `b2ccf95e3`; waterSurface/painterly stay charged, frozen callers)
- P4 output census `950f03329` (per-shard closure table next)
- KA1/KA4 ABI + host seam `26dc60708`, gate mapping `f85e9a1de`
- physicsRows pin dropped (5 MB JSON cap) `37a3311c5`
- G457 rows `618dc69ee`
- Jake OK'd per-shard runtime/ ceilings and Pine on DW creature hosts (o274: 1 of 6 hosts had a Pine twin; ~284 lines stay DW's)

**Lanes:**
- Codex: x1 live catalog reader → KA3 · x4 KA2 DecisionHost · x5 KA1/KA4 harness · x6 meshopt GLB intake · x7 P4 per-shard report · x8 Z1 (v1 reader deletion).
- Opus: o270 Pine sections switch · o276 DW Safari frames · o277 DW sections end to end · o278 Pine runtime moves w/ perf edits · o279 graph node-build cache.

**fps:** o275 attributed the Pine road misses:
- ~70 % is three.js node builds per material during the entry warm (10 builds of 15–20 ms);
- then post-link program resolution (107–164 ms Safari) and late texture uploads.
Measured (desktop / Safari):
- plain: travel p95 33 / 102 ms;
- prewarm row: 33 / 81 ms. No pass, so the row stays off.
o279 is building a node-build cache behind a Debug row. Still failing: DW Safari (o276), Sky/Signal Safari road, Nine drive max.

Paused: SF22 SF57 SF67.
