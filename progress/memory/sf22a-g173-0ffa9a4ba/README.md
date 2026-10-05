# Driftwood G173 measured-default refresh (SF22a / G144, E435)

The measured standalone composition remains below the unchanged 1,000 MB playing/Explorer limit in all six cold runs. **Default hybrid OFF play median: 668.394 MB native WebContent + labelled GL; hybrid ON: 703.511 MB.** The highest settled cold value is 709.721 MB. Keep the transient: one OFF Explorer native phase high reaches 752 MB, or **957.1 MB with GL (42.9 MB headroom)**. These are Simulator plus desktop-GL composition readings, not a physical-phone pass or a measured whole-grid run.

## Protocol and provenance

Clean source `0ffa9a4ba` (Jake G173: GPU-only copies and island instancing are now the only paths), served build `0ffa9a4-muumyh0u`. Sampler `3560329926e63ceedf26d07315d2d883070a26d9`; no sampler/source WIP. iOS 26.5 iPhone 17 Pro Simulator Safari, sequential hybrid OFF then ON, three cold origin resets/Safari restarts per case. Play and Explorer each run for 30 seconds; each phase is the median of three one-second native/Inspector samples. The table uses the three independent cold-run medians and retains the full range, with no outliers dropped. All six identities/Debug picks and all 18 native phase-high checks pass.

The Simulator shuts down before the matching fresh Chromium/Metal labelled-GL census, iPhone 16 Pro 390×844@3, 15-second settle plus 10-second sample. GL includes buffers, textures/full mip chains and renderbuffers. GPU-process RSS and Inspector totals remain separate; neither substitutes for GL or gets added again.

| Hybrid | Native play MB (cold range) | GL MB | Play native + GL MB (range) | Explorer native + GL MB (range) |
|---|---:|---:|---:|---:|
| OFF | 463.294 (458.903–484.446) | 205.1 | 668.394 (664.003–689.546) | 676.488 (670.425–701.981) |
| ON | 499.011 (468.733–505.221) | 204.5 | 703.511 (673.233–709.721) | 682.458 (680.475–691.485) |

ON play has a 36.487 MB cold range; OFF has 25.543 MB. ON play is 35.717 MB above OFF, but Explorer medians are only 6.570 MB apart. This receipt records the timing/spread rather than claiming a new retained-object leak from these footprint readings. Both cases retain approximately 58 MB of geometry arrays plus 15.101 MB of instance arrays at Explorer. Native/Inspector phase peaks and settled samples are in [summary.json](summary.json) and the case JSONL files; transient peaks are not discarded.

## Metadata and admission

The shared Driftwood constant now records the default-path median rounded to **463.294 MB WebContent + 205.1 MB GL**, with revision and this evidence path. The dated 299 MB engine calibration remains `91f97bdfc`, [original calibration](../sf22a-2026-10-04.json); it was not remeasured. G144 removes it once and undoes 1.11 once in `runtimeAccountedBytes`; the allocator applies its unchanged calibration/base/overlap.

- New exact home claim: **332,787,388 bytes**; modeled home playing total: **749,394,001 bytes** including base and overlap.
- Previous metadata: 606.097 + 282.4 MB; claim 531,078,379 bytes; playing 969,497,001 bytes. The new recorded total is 220.103 MB lower; no budget or factor changes.
- **12/12 focused fixtures across three files pass**: exact runtime calibration, page-boot preclaim/refcount cleanup, and real-platform byte plans/admission. The historical pre-G173 road.deck refusal remains an independent fixture with its original measurement and assertions. The new default admits all six platform render parts under the same cap; all leases dispose back to the home baseline. Existing plan-equals-measured cases are unchanged.
- Full-grid neighbour residency and actual page peaks remain separate admission/proof work. A standalone transient with 42.9 MB margin is not a promise that arbitrary neighbours fit.

## Reproduce and cleanup

Commands and sampler hashes are recorded in summary.json. Build the clean pin with `scripts/serve-build.sh --rev 0ffa9a4ba`; run each case through sim-lane with `scripts/sim-memory.mjs --runs=3 --play=30 --fly=30 --shards=driftwood-isle --device-save=debug.plugin.driftwood-isle.driftwoodHybrid=<off|on>`, then the matching `scripts/crossroads-rig/desktop-probe.mjs` through browser-lane after Simulator shutdown. `python3 aggregate.py <study-folder>` regenerates measurement rows (summary also includes the receipt/admission metadata).

Raw native/Inspector JSONL, plans/reports/tables, both GL reports and four zero exit codes are retained. Incidental generated device/session telemetry is omitted; sampler screenshots/phase scratch files are discarded. All owned browsers, Simulator and preview are closed.
