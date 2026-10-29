# Phone-speed loading, round 1 (live `a6701db71-mvsi9z8w`, 2026-10-28)

Golden flow: title → INFINITE WILDSHARD (Developer on) → control (`ws:control-ready`). Plan:
[phone-loading-2026-10-28](../../../project/archive/2026-10-29-phone-loading.md).
Chromium as iPhone 16 Pro (402×874, DPR 3, phone tier), muted, through `scripts/browser-lane.sh`; CDP throttles both the
page and the service worker. WebKit check: iOS Simulator Safari (iPhone 17 Pro) through `scripts/sim-lane.sh`, Mac speed.

## Totals, tap → control (s)

| Profile | Cold | Warm |
|---|---:|---:|
| **Phone: CPU 10×, 10 Mb/s down, 2 up, 100 ms RTT** (this round's flow) | **53.3** | **27.6** |
| CPU 8×, 10 / 2 Mb/s, 100 ms | 47.3 | 22.9 |
| CPU 6×, LTE 20 / 5 Mb/s, 60 ms | 35.0 | — |
| Same phone profile, SHARD SELECT → Driftwood → ENTER WORLD | 51.7 | — |
| iOS Simulator Safari, no throttle | 9.8 | 7.3 |

Title before the tap (cold): menu painted 1.6 s after navigation; tap → loading screen 0.45 s.

## Per row, phone profile (the loading screen's own row times, s)

| Row | Cold | Warm | Sim cold / warm |
|---|---:|---:|---:|
| 1 Application modules | 6.0 | 2.7 | 1.8 / 0.8 |
| 2–9 admission, data, Region world, Renderer, Equipment | 1.4 | 0.8 | < 0.3 |
| 10 Gameplay and saved state | 1.2 | 1.3 | < 0.3 |
| 11 World assembly (25 cells, 40 seams) | 4.0 | 2.2 | 0.6 / 0.4 |
| unlabelled gap, row 12 → 13 | 1.2 | 1.2 | 0.4 / — |
| 14 Home region (product admission + build) | 32.9 | 12.3 | 3.0 / 1.9 |
| ↳ product admission (measure) | 12.7 | 2.7 | |
| ↳ grid.prepare create (measure) | 20.7 | 10.2 | |
| 19 Road system + gap | 0.4 | 0.4 | |
| 20 Shaders (93 programs) | 3.5 | 3.9 | 0.7 / 0.6 |
| 21 First frame | 1.2 | 1.2 | |
| Ready → control (reveal fly-in) | 2.2 | 2.3 | 3.0 / 3.0 |
| **Total** | **53.3** | **27.6** | **9.8 / 7.3** |

## Network and CPU, phone profile

| | Cold | Warm |
|---|---:|---:|
| Requests tap → control | 548 (194 SW → network, 345 served by SW) | 288 (274 served by SW) |
| Script requests tap → control | 233 | 235 |
| Network bytes tap → control | 28.0 MB | 0.0 MB |
| First Driftwood pack request | +12.0 s | — |
| Seconds with no download in flight | 8 of 54 (34, 39, 45–50) | — |
| Main-thread busy (CDP TaskDuration) | 35.4 of 53.3 s | 25.9 of 27.6 s |
| Long tasks > 50 ms before control | 96, 11.7 s | 93, 11.5 s |
| Longest long task | 0.57 s | 0.56 s |
| Frame gaps > 1 s | 0 | 0 |
| In the 4 s after control | 117 requests, 47 long tasks / 4.6 s | 12 requests, 48 / 4.6 s |
| Console errors / failed requests | 0 / 0 | 0 / 0 |
| Download % drops shown (Sim) | 12 | 4 |

Sheets in this folder: `chromium-grid-cold-sheet.jpg`, `chromium-grid-warm-sheet.jpg`,
`chromium-select-driftwood-cold-sheet.jpg`, `webkit-sim-grid-cold-sheet.jpg`, `webkit-sim-grid-warm-sheet.jpg`.
Videos (not committed): `tmp/phone-loading/*.mp4`.

## Shared measuring command (G862)

`pnpm phone-loading --live --preset phone --flow grid --record --webkit`
runs cold, then warm in the same context, with a fresh document per entry.
Use `--flow select:driftwood-isle` for SHARD SELECT, `--head` / `--rev SHA`
for a shared pinned preview, or `--url http://127.0.0.1:PORT/` to attach an
already served working candidate. The command owns the browser-lane lease,
mutes audio and uses the iPhone 16 Pro viewport. The title dwell defaults to
3 s; `--title-dwell 10000` measures the title-prefetch row's 10 s protocol.
After control the default 4 s background-copy window matches the original
capture; `--after-control` changes it explicitly. It is outside the total.

The `phone` profile is CPU 10× / 10–2 Mb/s / 100 ms RTT; `lte` is CPU 6× /
20–5 Mb/s / 60 ms; `desktop` removes emulation. Chromium throttles the page
and worker network before their requests. Worker CPU emulation is unsupported.
Playwright WebKit has no equivalent CDP throttle: its JSON explicitly records
an **unthrottled engine check**, never a phone-speed-equivalent measurement.

Each engine/cache run writes one JSON in `tmp/phone-loading/<date-build>/`,
plus an optional video and labelled contact sheet. The table separates page
network, worker network and page responses served by the worker; do not add
cached page bytes to physical network bytes. Incomplete requests retain a null
end. All console/page errors and incomplete attempts remain visible.
`rows[].duration` is exclusive time; `wallMs` is the true end minus start.
`measures[].detail` is preserved, including batch calls / elapsedMs / longestMs:
a first-to-last wall span is not the sum of waits. Older builds expose only
visible rows, marked as such; they cannot recover collapsed quick-step clocks.
Their labels, details and durations are read from separate DOM fields. The
`data-started-at` boundary is native; the first completed-row observation is
explicitly `endBasis: observed`, rather than an invented start + exclusive time.
Aggregates without a native start use `startBasis: observed`; their wall field
is the observation interval. Native snapshots retain exact boundaries. Todo
rows remain in JSON but are omitted from the printed step table.
`errorDetails` retains each message, source, URL and timestamp, and the printed
error table shows those records. The request ledger belongs to the context,
so a cold request completing during warm keeps its original start/window.

The committed [baseline-a6701db71.json](baseline-a6701db71.json) normalizes the
retained **original live capture**, not a rerun: 53.270 / 27.556 s, 548 / 288
requests and 96 / 93 long tasks. Original missing absolute row ends and measure
details stay null. `--compare art/loading/round-1-phone-speed/baseline-a6701db71.json`
prints total regressions over 10% or step regressions over 1 s in red, without
changing the exit status. Actual incomplete/error runs still return nonzero.
No CI job, budget gate or scheduled automation uses this command.
