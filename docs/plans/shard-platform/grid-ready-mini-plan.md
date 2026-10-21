# Grid-ready for one shard: mini plan for the builder (G557)

Jake, 2026-10-21 ~08:20 Cancun: *"FFS grid readiness will never complete right? Make me a mini plan to complete grid
readiness for one shard."* And: *"grid readiness should not be blocked on my iPhone; we should have a final iPhone
readiness check for the shard platform plan, like a final step after everything else is done, once the whole mega plan is
99 %"* (G558).

## Why it never completes today

At ruler ed51b1446 every shard passes four of the six M2 criteria (baked tiles, edge profile, four entries, HUD accent).
`memory` and `oneFrameLooks` are `unknown` for all ten, and always will be under the current rule:

1. **Exact-SHA receipts.** `scripts/grid-runtime-evidence.mjs:40-60` only accepts an iOS Simulator receipt whose source
   SHA equals the ruler's revision (`source!==revision → continue`). Main moves about 40 commits an hour, so by the time
   a Simulator run lands its receipt, the ruler measures a newer HEAD and the receipt no longer counts. Pastel-plain and
   ink-cel-valley did pass 6/6 once (O9), then fell back to unknown on the next commit.
2. **Only the Simulator can supply them (today).** `memory` needs a native WebContent + GPU reading (soak or milestone receipt
   with `measurement: native-footprint+gpu`); `oneFrameLooks` needs a Simulator entry/look/travel receipt. Simulator
   time is the scarcest resource on the machine (G549).
3. **The memory cap was read as a page total**, not per shard (fixed by G556).

## Rows

| Row | What | Code | Effort (est.) |
|---|---|---|---|
| **R1** | **Receipts survive unrelated commits.** A receipt counts for a later revision when the shard's own product key and the grid runtime's key are unchanged since the receipt's SHA (the per-shard read keys B1 already computes, plus a key over the grid page runtime: engine/game grid, shardfile loader, renderer). A change to either makes the criterion `unknown` again (never a stale pass). The ruler prints, per criterion, the receipt SHA it used and why it still applies | `scripts/grid-runtime-evidence.mjs:40-90`, `scripts/shard-milestones.mjs:66`, the B1 key code (`shardfile-cache.mjs`) | 0.5 day |
| **R2** | **Memory per shard (G556)**: the criterion compares that shard's own peak (standalone, or its cell's share on the grid) against 1.2 GB playing / 1.8 GB loading, never the page total | `grid-runtime-evidence.mjs:48-50`, the soak's per-owner attribution | 0.5 day |
| **R1b** | **Chromium / agent-browser evidence (G559)**: `oneFrameLooks` and `memory` accept a headless Chromium or agent-browser receipt (phone tier, iPhone 16 Pro profile, 4x CPU throttle, muted) as well as a Simulator one: the look/travel windows with no frame over 200 ms and no context loss, and memory as the shard's own peak from the game's residency accounting plus the browser's process/GPU memory over CDP, against 1.2 / 1.8 GB. Today the code only takes `surface: 'sim'` for these two (`grid-runtime-evidence.mjs:72-84`) | same files + the frame-floor / soak drivers' Chromium path | 0.5 day |
| **R3** | **First shards: Template 1 (`_template`) and Template 2 (`blender-template`)** (Jake: *"Simple ones like the template 1 and 2 should be super quick to get grid ready right"*): native, no custom code, already 4/6, small worlds. One Chromium run (`scripts/browser-lane.sh`, no Simulator, G559): grid entry into each, look and travel windows, leave, and a native memory reading while each is the entered cell; receipts committed at that SHA. Signal Dunes (`sunscar-dunes`) is next in the same session if time allows | `scripts/browser-lane.sh`, the frame-floor / soak drivers | one run, minutes |
| **R4** | Read the ruler: if both criteria pass, each template reads 6/6 and **M2 shows 2 of 10**. If either fails, fix that one finding (a frame over 200 ms, a memory peak over the shard's cap), re-run once | per finding | 0.5–1 day |
| **R5** | **Repeat as a batch:** one Chromium run per build measures several shards in a row (Signal, Sky, pastel-plain, ink-cel-valley, then Pine, Driftwood, Nine, Nalati); with R1 the passes stay until that shard or the grid runtime changes | any lane, through `browser-lane.sh` | one run per batch |
| **R6** | The `frameFloor` criterion stays a separate, reported line; it does not block M2 (coordinator ruling X0, 10-20) | | |

**Done when** Template 1 and Template 2 read 6/6 on the ruler and stay 6/6 across unrelated commits for a day. Then R5 takes the rest.
No Simulator in this plan either (G559): the Simulator only reproduces what Chromium can't. Jake's iPhone is not in this plan: the phone check is SHARD-PLATFORM's final row at 99 % (G558).
