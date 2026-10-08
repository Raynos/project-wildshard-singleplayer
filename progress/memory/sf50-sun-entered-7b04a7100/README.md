# Signal Dunes entered native ruler (SF50-g, E435)

Three cold Safari runs passed on source `7b04a71009de93f059c8208d101f18e2c55ceeed`, build `7b04a71-muzljc2s`: **3 valid / 3 attempts, 0 failures, GPU restarts, game errors or recoveries**. Each run used the north road, entered Signal Dunes, walked to its authored spawn (0, 70), returned to the road and re-entered through real held input. All 12 actual-frame route witnesses passed. Final unload matched the complete baseline census exactly, with zero disposal errors and zero scopes; three fresh final samples kept the original WebContent PID.

Decimal MB; each cold run has three fresh independent kernel samples per settled pose, paired with that pose's live labelled GL. The table summarizes the per-run medians; ranges are across cold runs.

| Pose | WebContent median [range] | Labelled GL | Combined median [range] | Modelled playing |
| --- | ---: | ---: | ---: | ---: |
| North road | 669.65 [650.65–752.75] | 95.55 | 765.21 [746.20–848.31] | 526.54 |
| North entry | 676.12 [667.37–727.55] | 159.11 | 835.23 [826.48–886.66] | 582.10 |
| Authored spawn | 712.35 [670.65–733.19] | 155.85 | 868.20 [826.50–889.04] | 575.31 |
| Road return | 732.24 [700.85–752.44] | 95.90 | 828.14 [796.75–848.34] | 526.54 |
| North re-entry | 754.06 [712.15–755.27] | 159.35 | 913.41 [871.50–914.62] | 582.10 |

The largest individual native sample plus its pose's GL is **914.69 MB**. All sampled entered stops are below 1.0 GB. GL is identical across the three runs at each matching pose, reconciles exactly and has zero positive unlabelled bytes. The measured/modelled gap remains explicit: re-entry is 913.41 MB median versus 582.10 MB predicted. This does **not** establish allocator calibration or attribute that gap to Signal Dunes alone.

This is an iOS Simulator Safari regression ruler with Memory saver on, Developer on, phone tier / 2×, Auto textures and muted audio. Every run terminated Safari, cleared origin state and used one Inspector, one sampler and a fixed WebContent PID. Other Debug choices use build defaults. One initial road pose was seeded; every later movement was through the production motor. Camera rotation at the spawn was normal rendering; no heap collection, frozen creatures or continuous mutation journal was used. Other game browsers remained closed during this cohort.

This is **settled-stop evidence**, not a continuously paired loading/travel peak, physical-iPhone cap verdict, frame-floor pass, all-edge native cohort or thirty-minute soak. The earlier standalone calibration remains separate at `progress/memory/sf50-sun-runtime-744cf67ef/`; this receipt does not replace the shared shard-owned runtime metadata with an entered-page delta. The four-edge browser receipt is a separate functional check.

Reproduce each cold attempt, keeping failures and continuing until at least three are valid:

```sh
scripts/browser-lane.sh --max 20 scripts/sim-lane.sh run --max 20 wildshard-iphone node progress/memory/g227-budget/native.mjs http://127.0.0.1:4450/ <scratch>/cold-01.json <owned-dist> sun-entry on north
node progress/memory/sf50-sun-entered-7b04a7100/summarize.mjs
```

The owned preview was `/private/tmp/wildshard-serve/20261008-085231-4450/dist`, verified by matching disk/HTTP version and owned listener/PGID. Raw reports, sampler journals/logs and vmmap summaries are losslessly gzipped under `native/`; `archives.json` records original byte counts and SHA-256. Readback was byte-compared before archiving. The summarizer independently checks all route witnesses, fixed-PID/fresh samples, same-pose GL and exact teardown; it refuses a two-valid-run cohort. The diagnostic fixture is archived, and `fixture-provenance.json` records removal of only that exact owned block, with every other index byte hash-verified unchanged. All native clients and the Simulator were closed before explicit handoff to sp-x3.
