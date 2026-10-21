# Driftwood and Pine to zero: blockers and rows (G570)

Jake, 2026-10-21 ~16:50 Cancun: *"do we need to update the mini plan of how to get them to zero? Do we find any new
blockers?"* Yes. Measured at HEAD `d16f3c3ae3` with `sourceProgressInventory()` (every span classified by the plan
agent's subagent from the code and the lanes' triage notes; buckets are a reading, not computed): **Pine 787,
Driftwood 911.** Already below G519's 5 % line: Pine 3.7 % (5 % = 1,065), Driftwood 5.3 % (5 % = 858).

## Where the lines are

| Bucket | Pine | Driftwood | What it is |
|---|---|---|---|
| **A** cuttable now | 100 | 383 | Claimed rows: QC spawn director (still charged, 30), X20, G1d; Driftwood `world/build.ts` 151 (G3/O13/O8), `hybrid.ts` 78 (X11), hull-book creatures 32, AS body ops 25 (QD/G566), loot/economy 29 (G553) |
| **A?** needs a new row | 106 | 10 | Pine `landmarks.ts` 50, `hybrid.ts` 44, `context.ts` 12: plugin wiring only a Pine declared-entry row (like Driftwood's X11) removes |
| **B** needs a second user (G518) | 365 | 352 | Pine boot file policy 82, `installChapterLead` 69, King 54, posedInstances 61, shelter 25; Driftwood `quest/install.ts` 91, `blobAssets.ts` 56, NPC head focus 55, pageGroups 43, people/trader 54, gulls 20, islandCover 18 |
| **C** per-frame view, listed until WASM-HOST | 174 | 166 | Pine `quest/views.ts` 63, `poolSurface.ts` 62, `beaverPool.ts` 33; Driftwood rope bridge 128, creatureLooks 21 |
| **D** frozen legacy | 30 | 0 | `TRAMPLE_GLSL`, imported by the frozen pine-hollow-legacy runtime: **left alone, deleted with the legacy (G572); not a blocker** |
| **E** Jake's call | 12 | 0 | grid-vs-standalone memory trim (dies only if standalone Pine retires) |

**Floor under today's rules** (every A and A? lands, nothing else moves): Pine ~580, Driftwood ~520; with the usual
partial cuts expect 600–650 each. **G532's own target (≤150 listed per shard) is not reachable with today's rows:**
listed view code alone is already Pine 174, Driftwood 166, and nothing in the ruler tags a span as listed.

## New rows

| Row | What | Lines |
|---|---|---|
| **ZA** | Finish the claimed A rows (QC's charged spawn director, X20, G1d, G3, X11, QD, G553) | ~480 |
| **ZB** | **Pine declared-entry row**, as Driftwood's X11: landmarks/hybrid/context wiring onto the declared runtime entry | ~106 |
| **ZC** | **AS + data for the renderer-free one-user code** (G532 allows it): Pine shelter, chapterLead's route decisions; Driftwood pageGroups projection and the quest logic in `quest/install.ts`; Pine boot policy / manifest as data rows | ~120–150 |
| **ZD** | **The right hosts, added to the engine/game (G571)**: for every one-user span (bucket B) design the generic data/AS host it belongs in (Blender island loader with Template 2, NPC head focus and placed figures, posed instances, boot file policy as data, herd shelter, chapter lead …); Jake approves them as platform from day one when they pass HOST-BAR tests 2–6 | ~350 (all of B) |
| **ZE** | **The ruler tags listed view code** (a `listed` list per shard, HOST-BAR's register), so "listed" is measured and shown separately from custom | 0 (measurement) |
| **ZF** | The remaining per-frame code (bucket C, plus King pose, posedInstances, figures, gulls, cover) needs WASM-HOST's view frame lane (H0, H0b, H1–H6, H9, H13 cutover); scope Pine's and Driftwood's lines into WASM-HOST's "Ties" section | ~350–450 per shard |

After ZA–ZD: about 300–450 per shard, nearly all per-frame view code. **Strict zero needs WASM-HOST (ZF)**, or a rule
that listed view code doesn't count as custom.

**How (G571, Jake):** every line becomes data (rows, build-time generators) or AssemblyScript/WASM (decisions now; per-frame view through WASM-HOST's view lane, ZF). New hosts are fine where the right abstraction needs one. No shortcuts: no relabelling, no moving code to dodge the counter, no 'no honest cut' closes; a lane that can't find the correct design asks the coordinator for the host design instead of looping.

**Done (G572, Jake):** no custom TypeScript left in `src/shards/pine-hollow/` and `src/shards/driftwood-isle/`, and the ruler reports nothing else against them. Legacy-only code waits for the legacy deletion.
