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
| **R1** | **Done (2026-10-21, sp-x1): `5615bf9d46`, pushed `f762cfebc9`, four O9 memory/look criteria latched; focused tests and full carrier gate green. One pass, then latched (G560).** A shard's `memory` / `oneFrameLooks` pass is recorded once (shard, criterion, receipt SHA) in a committed latch file and counts on every later revision: no expiry on commits, checksums or source changes. Pastel-plain and ink-cel-valley latch now from their O9 receipts (`2fc35330d3`, `cb025a094a`). A latch is removed only by hand when a real regression is found. The ruler prints the latched receipt for each criterion | `scripts/grid-runtime-evidence.mjs:40-90`, `scripts/shard-milestones.mjs:66`, a latch file under `progress/shard-platform/` | 0.5 day |
| **R1b** | **Done (2026-10-21, sp-x1): qualified phone-profile/CDP guards and maintained route driver `df58ee81b0`, pushed `f762cfebc9`; full local gate green. Chromium / agent-browser evidence (G559)**: `oneFrameLooks` and `memory` accept a headless Chromium or agent-browser receipt (phone tier, iPhone 16 Pro profile, 4x CPU throttle, muted) as well as a Simulator one: the look/travel windows with no frame over 200 ms and no context loss, and memory as the shard's own peak from the game's residency accounting plus the browser's process/GPU memory over CDP, against 1.2 / 1.8 GB. The driver now emits `surface: 'chromium'` with its observed phone profile and separate CDP samples | same files + the frame-floor / soak drivers' Chromium path | 0.5 day |
| **R3** | **In flight (2026-10-21, sp-x1; GR3). 5/10 playable shards and 15/15 plots have qualified latches after `72c5300599`; Signal, Sky and Lantern pass under load with `quiet:false`. Template 1 entry at 216.7 ms remains unconfirmed pending its quiet repeat. First batch (G560): Template 1 (`_template`), Template 2 (`blender-template`), Signal Dunes, Sky Reach and the 15 open plots; each pass latches** (Jake: *"Simple ones like the template 1 and 2 should be super quick to get grid ready right"*): native, no custom code, already 4/6, small worlds. One Chromium run (`scripts/browser-lane.sh`, no Simulator, G559): grid entry into each, look and travel windows, leave, and a native memory reading while each is the entered cell; receipts committed at that SHA. each pass latches (R1) | `scripts/browser-lane.sh`, the frame-floor / soak drivers | one run, minutes |
| **R4** | Read the ruler: with the two latched from O9, **M2 shows 6 of 10** (Template 1, Template 2, Signal, Sky, pastel, ink) plus the plots. If either fails, fix that one finding (a frame over 200 ms, a memory peak over the shard's cap), re-run once | per finding | 0.5–1 day |
| **R5** | **Repeat as a batch:** one Chromium run per build measures several shards in a row (Pine, Driftwood, Nine, Nalati, as each is ready); every pass latches | any lane, through `browser-lane.sh` | one run per batch |
| **R6** | The `frameFloor` criterion stays a separate, reported line; it does not block M2 (coordinator ruling X0, 10-20) | | |

**Done when** the six zero-custom shards and the plots read 6/6 and stay latched. Then R5 takes Pine, Driftwood, Nine and Nalati, each only after it reaches zero custom (G561).
GR3 acceptance ruling (2026-10-21, coordinator): a qualified Chromium pass under machine load may latch, with `quiet:false` recorded in its latch and receipt. Load can only worsen cadence; a non-quiet miss stays unconfirmed and needs a quiet repeat before it becomes a failure. Profiling still supplies no acceptance credit.

No Simulator in this plan either (G559): the Simulator only reproduces what Chromium can't. Jake's iPhone is not in this plan: the phone check is SHARD-PLATFORM's final row at 99 % (G558).
