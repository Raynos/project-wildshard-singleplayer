# Memory saver at Nalati centre and the empty road

E435 / G227, 2026-10-08. Game pin **65106ea87662db1cd0602be1f8a6b7d4e5216b1d**, sampler **acfac7c55**. One cold Safari iPhone 16 Pro Simulator run per setting, Developer ON, phone Auto/KTX2, 2×, muted, default content. Three settled one-second WebContent physical-footprint samples per pose (median below), plus that pose's labelled live GL. WC + GL is the independently tested ruler; Inspector heap categories are subsets, not extra bytes. No forced collection precedes these samples.

The existing Settings > Debug > Memory saver is explicitly saved OFF/ON and **verified from the loaded document at every pose**. Standalone/default behaviour and the row are unchanged by this receipt. The route enters owned Driftwood, drives directly into Nalati and to its centre, then returns to the neutral road and verifies `residents=[]`.

| Pose | OFF WC MB | OFF GL MB | OFF combined MB | ON WC MB | ON GL MB | ON combined MB | ON − OFF MB |
|---|---:|---:|---:|---:|---:|---:|---:|
| Home | 517.263008 | 211.842683 | 729.105691 | 609.128000 | 196.167259 | 805.295259 | +76.189568 |
| Nalati entry | 749.719344 | 310.395848 | 1060.115192 | 760.090344 | 297.866152 | 1057.956496 | −2.158696 |
| Nalati centre | 818.843440 | 306.902020 | **1125.745460** | 806.653696 | 294.372324 | **1101.026020** | **−24.719440** |
| Empty road | 827.412320 | 136.083318 | **963.495638** | 812.797744 | 120.407894 | **933.205638** | **−30.290000** |

**No cap pass at Nalati centre:** ON remains 101.026020 MB over 1.0 GB, and 151.026020 MB above the 950 MB margin target. The empty road has 66.794362 MB margin. These are single cold runs, not repeat medians or a physical-iPhone verdict. Home WC varies by 91.865 MB between the two runs; the modest process delta is not isolated causal proof of the entire cut. No default change is justified by calling this an in-cap result.

The exact observable effect is clearer in retained scene backing stores: centre **112.049410 → 69.215552 MB**, **42.833858 MB fewer**, with 432 released attribute descriptors left untouched. At entry the same difference is observed. Outcrop normal/colour arrays (5.926752 MB each) disappear; its positions remain. Kurgan-interior position/normal/colour copies (4.007376 MB each) remain because unseen geometry has not drawn long enough to release. Positions, indices and dynamic instance data remain intentionally. This is a deduplicated direct scene inventory, not an allocation of the whole WC footprint or the anonymous native ArrayBuffer heap class.

Both routes have **zero page errors/rejections, no document recovery, and no Memory saver restore/sampler warning**. The only console warning is Three.js's existing Clock deprecation. The held model, capsule and authoritative residency route are exercised normally; this is not a screenshot-only hidden-world measurement.

## Measurement traps fixed

- Reading `attribute.array` restores a released CPU copy from GL. The census now reads only data descriptors, records released getters without invoking them, and deduplicates shared backing buffers. A real-expression regression also covers interleaved attributes.
- Reusing a preview had left an older OFF init after the new ON seed. The first requested-ON trial actually observed OFF and is **invalid as ON evidence**. It is excluded from the table and summary. The sampler now removes only its own prior inline fixture and refuses any observed setting mismatch. Regression retains the production module script while removing old tagged and legacy harness seeds.
- Centre heap snapshots with the game drawing timed out at 120 and 300 seconds; neither produced a heap, so no new centre class/retainer table is invented. A separate snapshot-only frame-gated diagnostic is in progress; original pose measurements remain untouched. Existing road retainer evidence stays in `native-audit.md` / `audio-retirement.md`.

## Reproduction

Use an owned `serve-build --rev 65106ea87` preview from a scratchpad. For each fresh Safari/Simulator run:

```
scripts/browser-lane.sh --max 15 scripts/sim-lane.sh run --max 15 wildshard-iphone \
  node progress/memory/g227-budget/native.mjs BASE OUT_JSON DIST nalati-route off
# Repeat with a different output path and final argument on.
node progress/memory/g227-budget/census-regression.mjs
python3 progress/memory/g227-budget/centreSummary.py
```

Compressed full reports and sampling JSONL, original vmmap summaries and `memory-saver-centre-summary.json` retain exact version, settings, native samples, GL labels, largest direct arrays, warnings and final empty residency. All measurement browsers/Inspector proxies/Simulator runs are closed before reporting. The subsequent centre-only diagnostic has its own lane and evidence, not a substituted reading.
