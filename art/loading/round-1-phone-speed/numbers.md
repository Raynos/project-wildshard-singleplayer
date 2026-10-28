# Phone-speed loading, round 1 (live `a6701db71-mvsi9z8w`, 2026-10-28)

Golden flow: title → INFINITE WILDSHARD (Developer on) → control (`ws:control-ready`). Plan:
[phone-loading-2026-10-28](../../../docs/plans/shard-platform/phone-loading-2026-10-28-mini-plan.md).
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
