# Pine G187 cuts 1–3 re-read (SF22a / SF47, E435)

On **8e82ae91f**, three cold **Auto** boots with **pineMemoryTrim ON** remain below **1,000 MB** under both requested rulers. Native WebContent and the separate same-pin labelled GL proxy give a conservative combined playing transient of **960.832 MB**, leaving **39.168 MB**. This is Simulator-relative and desktop phone-tier GL proxy evidence, not a physical-iPhone cap proof or simultaneous grid-residency proof.

| Phase | Native median [three cold range], MB | Labelled GL max, MB | Combined median [cold range], MB | Combined transient / cap margin, MB |
|---|---:|---:|---:|---:|
| Play | 648.990 [629.231–651.235] | 205.941 | 854.932 [835.173–857.176] | 920.441 / 79.559 |
| Explorer | 667.865 [647.172–670.552] | 246.332 | 914.197 [893.504–916.884] | 941.832 / 58.168 |

All three GL cold highs are **246.332 MB**. The conservative upper bound pairs the largest playing native interval high (**714.500 MB**) with that full-coverage GL maximum, even though they occur in different phases: **714.500 + 246.332 = 960.832 MB**. The largest loading interval high plus full GL is **1,027.832 MB**, leaving **772.168 MB** under the separate **1,800 MB** loading cap. Inspector values and GPU-process RSS remain separate in the raw records, never added as extra rulers.

| Named location | Native interval-high upper bound, MB | Matched GL high, MB | Combined transient / 1,000 MB margin |
|---|---:|---:|---:|
| Gate | 666.500 | 205.941 | 872.441 / 127.559 |
| Cabin | 664.500 | 206.368 | 870.868 / 129.132 |
| Pond | 667.500 | 203.341 | 870.841 / 129.159 |

**Gate** is the largest sampled named-location transient. Explorer is the larger matched phase transient. These are the three existing authored portrait probes plus the recorded play/Explorer route; they do not exhaustively scan every location. Native phase-closing highs are rounded to 1 MB; aggregation adds 0.5 MB to bound rounding and keeps every exact 100 ms kernel sample.

## Comparison and provenance

The same-coverage cut-1 interim at **42c50944c** gave a conservative **967.221 MB** bound (32.779 MB margin). Cuts 2 and 3 lower the full GL maximum from **281.721 to 246.332 MB** (−35.389 MB). Native play and Explorer medians increase by **24.460 / 21.250 MB** in this repeat, with roughly 22–23 MB cold ranges; the receipt keeps that variability. Combined median play/Explorer fall by **8.831 / 14.139 MB**; the conservative bound falls **6.389 MB**. No successful run is omitted and no cap is raised.

Clean source **8e82ae91f701f8990199fe92407e4f1c61f14b20**, served identity **8e82ae9-muyoer44**, includes cut 2 **02543ff4a** and cut 3 **69ff4a7dd**. Three cold Safari process restarts and origin resets, each with 30 s rotating play, real `capturePoses()` gate/cabin/pond probes (120 frames plus three settled one-second samples), return to the original player pose, then 30 s World Explorer flight plus three settled readings. Standard seed1 harness, live clock (`capture:null`), phone render scale 2. Only the standard bootstrap tag is inserted in the owned served HTML; its exact hashes are retained in `bootstrap.json`. Game bundles/assets remain the pinned export. No setup retries or lost WebContent processes.

After Simulator shutdown, three fresh muted Chromium/Metal **iPhone 16 Pro** portrait contexts repeat that coverage. All resolve cold Auto to **KTX2**, all ledgers reconcile with zero unlabelled resources and zero page errors. Full byte ledgers are gzip-compressed losslessly. Both device picks are explicit in `study.json`; no optimized reading replaces an unmeasured default-path runtimeCost. Owned browsers, Simulator and preview are closed.

## Reproduce

Use `scripts/serve-build.sh --rev 8e82ae91f`, then `node progress/memory/sf22a-pine-g187-42c50944c/sim-bootstrap.mjs <owned-export>/dist/index.html <build>` before boot. Through `scripts/sim-lane.sh run --max 30 wildshard-iphone`:

```sh
node scripts/sim-memory.mjs --url=<preview> --out=<empty> --runs=3 --play=30 --fly=30 --shards=pine-hollow --setting=tex=auto --locations=on --device-save=debug.plugin.pine-hollow.pineMemoryTrim=on
```

After shutdown, through `scripts/browser-lane.sh --max 20`, run `node progress/memory/sf22a-pine-g187-42c50944c/location-gl.mjs <preview> <empty>`. `python3 aggregate.py` reproduces `summary.json` from the preserved traces and phase GL totals.
