# SF22: cadence passes; isolated draw stalls remain open

On `a819411795ede65ceca6e860fa40c33b9604c6f4`, the real Driftwood → Signal → Driftwood
route admits both returns without errors or refusals. Developer OFF, Auto images,
Memory saver OFF, phone tier, DPR 2, muted; aggregate 5 Mbit/s and 3/10-second asset
stalls begin after the home is playable. Standing samples retain the actual final
pose. Both surfaces use the browser rAF timestamp of each completed Game draw;
callback-start and polling clocks stay diagnostic. No missed observations.

| Check | Previous comparable receipt (`77380da36`) | This run |
| --- | --- | --- |
| Safari route p95 / p99 | 36 / 53 ms | **34 / 46 ms** |
| Safari standing p95 / clock quantum | 34 / 1 ms | 34 / 1 ms |
| Desktop route p95 / p99 | 33.4 / 33.4 ms | **33.4 / 33.4 ms** |
| Desktop warm invocation maximum | 6.5 ms | **6.2 ms** |
| Desktop warm-task upper bound | 50 ms | **50 ms** (no reported warm Long Task) |

The headline 49 ms came from the older polling clock. It is not the before value
for this comparison. The older 51 ms desktop warm-task outlier did not recur;
absence of a Long Task gives a censored ≤50 ms bound, not an exact duration.
Safari has no Long Task observation, so its whole warm-task bound is unavailable.
The existing generic pacing, shared construction budget, message-port turns and
late frame-cap recovery were already enabled on this pin; this receipt changes
no scheduler, quality, clock, gate or runtime behavior.

**SF22 stays open.** The improved whole-drive maximum policy fails: desktop
366.6 ms >100 ms, Safari 301 ms >200 ms. P95 passing does not clear these stalls.
The whole routes record 26 desktop / 4 Safari shader calls outside
`renderer.compile`, including utility/warm-draw calls. Desktop's *explicit warm-up*
subset has zero outside calls and passes the 50 ms task bound; that is not a
zero-compilation claim for the whole route. The two largest Safari gaps overlap
new PBR one-point-light and zero-point-light variants. That overlap is a source
lead, not CPU, GPU or blocking-call attribution. A separate owner diagnostic is
queued; timers, awaits, ports, workers and GC are not assigned invented durations.

Quiet was 16:39:34–16:43:39 UTC, after the pusher exited and more than two minutes
after sp-x1's release. All owned browsers, Simulator helpers, preview and quiet
marker closed. The failed BSD-regex queue and reservation cancellation happened
before measurement and are retained in [summary.json](summary.json). Source
evidence remains scratch-only; no raw archive is committed. This subset does not
claim full G270 or physical-phone memory clearance.
