# sp-x3 handoff — 2026-10-08, idle

Idle at the coordinator's request. No retry, browser, Simulator, build or full suite is running or queued. No owned preview remains to stop. The coordinator alone pushes; no plan edits.

## Exact next step, after coordinator GO

Wait for the place-lifetime fix (place.ts records/cullers and assets.ts decode-cache key) to land, then obtain the coordinator's selected post-fix pushed pin and Simulator slot. Build one queued preview and run a **plain 30-minute SF57 soak**, Developer layout, the existing Driftwood → Pine → Nalati → template-copy subset route. Use the light c132 observer and coalesced exact-state GL journal, with raw storage tracing and call-site stacks OFF.

Use the existing soak driver with `--layouts=dev --legs=cells --route-scope=prepared` and its normal 30-minute duration. Do not enable `--diagnostic-circuits`, `--diagnostic-first-crossing` or `--dry-run`. **No heap snapshots, native VM inspection or extra diagnostic probes:** those visibly inflated WebContent memory in the last diagnostic. Preserve every failure, the WC + labelled-live-GL ruler, allocator accounting, independent GPU-process readings, per-loop peaks and settled growth. Close all owned resources and commit the raw evidence and receipt. This subset does not qualify full-catalogue or cap clearance; Sky/Sun, road-only and shipped-layout coverage remain open.

Transport close-code/reason retention and resilient final-result flushing are **later improvements**, not prerequisite work now. Do not implement them while idle.

## Durable results

- `3aa80594b`: e632 Developer subset dry5 functional PASS, 316.270 s, peak WC+GL 993.183 MB, no GPU loss.
- `16e2dde36`: full30 functional PASS / memory RED, 1811.547 s, six complete circuits plus partial seven, 47 route witnesses, all 16 crossroads, errors 0 / GPU losses 0. Peak WC+GL 1235.984 MB, 235.984 MB over the cap. Settled loop 2 → 6: 808.049 → 1012.101 MB (+204.052 MB). Sampling/leakZero passed; calibration/recovery failed. Evidence: `progress/memory/sf57/e632fe913-dev-subset/`.
- `0edc1ca2a`: offline split of that settled growth: WebContent +197.150 MB, labelled GL +6.902 MB, allocator unchanged. About 50.2 MB/circuit with no observed plateau. PMREM +6.881 MB was routed to Opus. This does not prove growth continues indefinitely.
- `abfd62c05`: post-SF69 diagnostic on `2fccee5ba` FAILED/incomplete at two of four circuits. Eight route witnesses passed. Boundaries 0/1/2 retained SF64/native/passive data; Heap.snapshot at boundary 2 closed Inspector before any heap payload. Cleanup RPC timeout prevented the final main-result flush: raw circuits=1 is stale, while eight witnesses prove two. Evidence and reproducer: `progress/memory/sf57/2fccee5ba-four-circuit/`.
- Diagnostic SF64 RAM: 196.036 / 355.382 / 531.403 MB; programs: 151 / 314 / 320. RAM circuit 1 → 2 rose 176.022 MB: buffers 127.251, bitmaps 35.652, canvases 7.877, images 5.243 MB. Renderer geometry stayed 251 → 251; GL rose 1.836 MB. Coordinator received this and relayed it to the place-lifetime Opus lane. These are CPU-source retention candidates, not strong-root proof without collection.
- Preinspection WC tails were 464.605 / 890.917 / 1213.699 MB. VM/heap inspection visibly increased WC; the failed-heap interval high of 2139 MB is intrusive and is not cap evidence. No new crash report or postboot WebContent disappearance was found; transport close reason was not retained. A 512 MiB transport payload limit remains an unproved candidate. No four-circuit leak rate or causal comparison against e632 is claimed.

## Driver, cleanup and retained paths

- Driver `2025b98f1` and lint forward `6d3165ebb` landed/pushed; 26 focused tests, scripts strict and scoped lint green. Required full validation had 5310 passes / nine foreign reds, accepted by the coordinator as shared WIP or centrally generated outputs. No source WIP from this lane.
- All owned Safari/Inspector/proxy/sampler processes closed, Simulator lane 0/1 verified, device `A274C713-B7DE-4AB6-BF56-8B24E53EFF38` shut down/deleted. Preview :4400 / PID 82624 stopped by preparation finally. No retry started.
- Diagnostic scratch `sf57-2fccee5ba-four-circuit` was deleted after exact raw archival into the repository. Original soak scratch remains at `/private/tmp/claude-501/sp-builders/sp-x3/sf57-e632fe913-retry`; preparation helpers remain at `/private/tmp/claude-501/sp-builders/sp-x3/sf57-e632-four-circuit`.
- Sun floor `2ed39b862`: 20/22 cadence rows passed, aggregate RED; receipt `progress/shard-platform/sf50-sun-floor-e632fe913.md`. HOVER `8f1918525` + `c932ce846` shipped, touch 4/4.
- Land through private index from current HEAD, hooks and CAS update-ref; verify subject/stat/ancestry. Never message wildshard-v. Older E459 scratch cleanup remains blocked by automatic review; no deletion retry, useful evidence is durable.
