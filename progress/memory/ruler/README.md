# The native ruler, fixed: nothing inspects the page before a reading (E435, G257, ruler lane)

2026-10-08, ruler builder (Opus). Jake's 1.0 GB playing cap is read on the iOS Simulator as **WebContent physical
footprint + same-pose labelled GL** with [g227-budget/native.mjs](../g227-budget/native.mjs). That ruler inflated its own
readings. **Every shard fits the cap once the inflation is gone.**

## What inflated the ruler: vmmap, not the census

The grid-base lane (`c2d910073`) blamed the in-page census. The census was the first suspect, but the A/B below shows the
real cause is `vmmap -summary`, which the old ruler ran on the WebContent pid at every pose. Pine centre, one tree
(`b49135480`), cold Simulator boots, Developer on, Memory saver on, phone tier, 2×, Auto textures, muted. WebContent MB:

| Arm (what runs at each pose after its footprint samples) | Runs | Home | Pine entry | **Pine centre** |
|---|---|---:|---:|---:|
| Old ruler: vmmap + light GL + full census | 2 / 2 | 557.7, 563.4 | 722.7, 763.7 | **865.9, 884.4** |
| vmmap + light GL, census only after the last pose | 2 / 2 | 467.4, 538.3 | 798.3, 862.8 | **914.1, 944.5** |
| vmmap only (no GL read, no census) | 3 / 4 † | 553.1, 528.3, 513.6 | 761.6, 759.3, 734.7 | **903.2, 831.7, 926.7** |
| Nothing (footprint only; GL + census after the last pose) | 3 / 4 † | 533.4, 528.9, 552.8 | 487.4, 507.1, 519.8 | **478.3, 489.8, 520.6** |
| **Fixed ruler:** light GL at each pose; vmmap + census after the last pose | 3 / 3 | 460.1, 437.5, 529.9 | 538.7, 501.6, 557.2 | **519.3, 506.0, 533.7** |

† One reading per arm comes from the batch log (`batch2.log.gz` / `batch3.log.gz`): a duplicate attempt from a second
queue loop overwrote that run's JSON when it failed on the existing sampler log. The failed duplicates are kept.

- **vmmap adds ≈ 410 MB of WebContent at Pine centre** (median 903 vs 490), and it accumulates pose by pose. Removing the
  census alone changes nothing beyond noise (875 vs 929, both with vmmap).
- The light GL read (the GL tracker's per-context sums) costs ≈ +29 MB at the median (519 vs 490), inside the ±50 MB
  cold-run noise. It stays: the cap ruler needs GL at every pose.
- g253's rejected Sky run 1 (grid-base `native-final.mjs`, which returned before vmmap) read ~300 MB lower for the same
  reason.

`native.mjs` now defaults to `--vmmap=last --census=final --gl=every`: each pose takes its three settled footprint
samples, then the light GL read; vmmap and the full census run once, after the last pose's reading. `--vmmap=every`,
`--census=every|none` and `--gl=last` remain for comparisons. Route mode `standalone-pine` boots `?chunk=pine-hollow` and
reads its spawn and the grid-base centre pose with the same sampler. **Every native.mjs number taken before `00eba560f`
is vmmap-inflated**, including SF47-g's 1,116, the Sky Reach 998–1,086 rows, the SF64 example pages and G233's public grid.

## Corrected verdicts (fixed ruler)

Tree `b49135480` (G253's KTX2 Sky default included), builds `b491354-mv033tge` / `b491354-mv074goi` (the same tree; the
first preview was stopped mid-batch and rebuilt, and every run checks the served build). iPhone 17 Pro Simulator, Safari,
phone tier, 2×, Auto textures, muted. **WebContent median of three settled samples + labelled GL; median [min–max] of
the valid cold runs; decimal MB.** Developer on and Memory saver on (how Pine, Nalati and Sky Reach are reached in the
grid today) unless stated.

| Pose | Valid / attempts | WebContent | GL | **WC + GL** | Worst high sample | Verdict |
|---|---|---:|---:|---:|---:|---|
| Pine Hollow centre (grid) | 3 / 3 | 519.3 | 231.3 | **750.5** [737.3–765.0] | 796.0 (entry) | **fits, 249 MB margin** |
| Pine Hollow entry (grid) | 3 / 3 | 538.7 | 233.5 | 772.2 [735.1–790.7] | | fits |
| Nalati centre (grid) | 3 / 3 | 500.1 | 275.1 | **775.2** [753.1–806.3] | | **fits, 225 MB margin** |
| Nalati entry (grid, its worst pose) | 3 / 3 | 564.9 | 278.6 | 843.5 [793.4–897.7] | 897.9 | fits, 157 MB margin |
| Sky Reach worst entered pose (island, every run) | 3 / 3 | 552.4 | 180.3 | **732.8** [729.9–821.9] | 838.6 | **fits, 267 MB margin** |
| Public grid home (Developer off, saver off) | 3 / 4 ‡ | 545.0 | 243.7 | **788.7** [780.0–808.2] | | **fits, 211 MB margin** |
| Public grid template centre (Developer off) | 3 / 4 ‡ | 523.6 | 247.5 | **771.1** [761.8–795.1] | | fits, 229 MB margin |
| Road after Nalati (grid) | 3 / 3 | 498.8 | 101.2 | 600.0 [578.2–626.5] | | fits |
| Standalone Pine centre (`?chunk=pine-hollow`) | 4 / 7 § | 527.6 | 259.4 | 787.0 [782.0–791.5] | | fits |

‡ One public attempt stopped at its own witness ("Developer is not saved and effective OFF"); kept.
§ Three standalone attempts lost the seeded settings to the standalone boot's save rewrite (two by the Memory saver check,
one by the readiness wait added after them); kept. This is a harness issue, not a game failure.

**Grid vs standalone, like for like:** Pine centre WebContent is the same in the grid (519) and standalone (528); the grid
holds 28 MB less GL (231 vs 259). There is no 425 MB grid overhead. Grid-base's Chromium figure of ≈ 90 MB retained RAM
does not show up as WebContent on this ruler; it is inside the run-to-run noise here.

These are settled poses on the Simulator, not a continuous peak and not physical-phone proof. Jake's phone readings stay
the playtest (G71).

## Files

- [b491354/](b491354/): every attempt's JSON (gz), valid and failed, and the batch logs. [summary.json](summary.json) is
  [summary.py](summary.py) over that folder (attempt / valid / failure counts, per-run rows).
- The SF64 report is regenerated on these runs: [../sf64-report/pages/](../sf64-report/pages/) from
  [report-input.json](report-input.json) (made by [report-input.py](report-input.py): each pose uses the arm's median run).
  The engine's attribution snapshot counts `unattributed` by label identity (`src/engine/core/memoryAttribution.ts`,
  `snapshot()`), so an allocation explicitly labelled `unattributed` lands in `totals` but not in `unattributed`, and the
  report refuses the snapshot. The `attribution-*.json.gz` sidecars recompute that one field from the snapshot's own rows;
  every allocation is unchanged.

Reproduce one arm (from a scratch dir, on a `scripts/serve-build.sh --rev <rev>` preview):

```sh
scripts/sim-lane.sh run --max 25 wildshard-iphone scripts/browser-lane.sh --max 24 \
  node progress/memory/g227-budget/native.mjs <base> <out>.json <dist> pine-centre on    # nalati-route on | sky-entry on | public-grid off
scripts/sim-lane.sh run --max 25 wildshard-iphone scripts/browser-lane.sh --max 24 \
  node progress/memory/g227-budget/native.mjs <base> <out>.json <dist> standalone-pine on --census=none
python3 progress/memory/ruler/summary.py <runs dir>
python3 progress/memory/ruler/report-input.py <runs dir> <manifest>.json && node scripts/memory-report.mjs --input=<manifest>.json --out=<new dir>
```

Plan-State: unchanged
