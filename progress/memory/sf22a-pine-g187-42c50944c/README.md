# Pine G187 cut-1 interim re-read (SF22a / SF47, E435)

On **42c50944c**, cold **Auto** with Pine memory trim ON is below the unchanged **1,000 MB** cap under both requested rulers for the sampled standalone coverage. Native playing/Explorer alone peaks at **685.5 MB** during play; the conservative native + full-coverage labelled GL transient is **967.221 MB**, leaving **32.779 MB**. These are Simulator WebContent and a separate desktop phone-tier GL proxy, not physical-iPhone cap evidence. Cut 2 / cut 3 are absent from this pin; their repeat remains required.

| Phase | Native median [three cold range], MB | Labelled GL max, MB | Combined median [cold range], MB | Combined transient / cap margin, MB |
|---|---:|---:|---:|---:|
| Play | 624.530 [617.353–634.049] | 239.233 | 863.762 [856.586–873.281] | 924.733 / 75.267 |
| Explorer | 646.615 [637.670–654.693] | 281.721 | 928.336 [919.390–936.414] | 959.221 / 40.779 |

GL cold highs over all coverage are **280.319 / 281.721 / 281.721 MB**. The strictest comparison deliberately pairs the largest native playing transient with the largest GL anywhere, even when they occur in different phases: **685.5 + 281.721 = 967.221 MB**. The largest loading native interval high plus that same GL bound is **1,060.221 MB**, below the separate 1,800 MB loading cap. Inspector readings and GPU-process RSS are retained separately; neither is added to WebContent + GL.

| Named location | Native interval-high upper bound, MB | Matched GL high, MB | Combined transient / 1,000 MB margin |
|---|---:|---:|---:|
| Gate | 650.500 | 235.736 | 886.236 / 113.764 |
| Cabin | 650.500 | 240.708 | 891.208 / 108.792 |
| Pond | 648.500 | 240.823 | 889.323 / 110.677 |

**Cabin** is the worst measured named-location transient (**891.208 MB** combined, **108.792 MB** margin). Explorer is the larger observed phase (**959.221 MB** combined transient). This is a maximum over the three existing authored portrait probes and the recorded play/Explorer route, not a claim that every possible world location was exhaustively scanned. Native phase-closing highs are rounded to 1 MB by the kernel sampler; aggregation adds 0.5 MB to their summary to bound that rounding conservatively and retains all exact 100 ms samples.

## Protocol and provenance

Three cold Safari restarts and origin resets, each with 30 s rotating play, the real `capturePoses()` gate/cabin/pond camera probes (120 real frames + three settled one-second readings each), return to the original player pose, and 30 s World Explorer flight + three settled readings. All three game identities and Explorer identities match **42c5094-muykvqpl / pine-hollow**; no WebContent loss or native driver errors. Whole cold ranges are retained, with no successful run dropped. Phone render scale stays 2. The standard seed1 harness changes no look/tuning and leaves the clock live (`capture:null`). Only its bootstrap tag is added to the owned served HTML; game bundles and assets remain the pinned clean export.

The Simulator shuts down before three fresh muted Chromium/Metal iPhone 16 Pro contexts repeat the same phase/pose work. Auto is explicitly seeded, never forced to KTX2: all three resolve **`ktx2`**, with reason **images-first playing estimate 1,273,195,441 exceeds 1,000,000,000**, and request 38–42 `.ktx2` assets from the cold origin. All byte ledgers reconcile and have zero unlabelled resources; zero page errors in the completed set. GL locations additionally sample allocation totals every tenth rendered frame. Complete labelled ledgers are gzip-compressed losslessly; phase totals remain plain JSON.

The first native instrumentation attempt failed because Safari did not retain Inspector bootstrap pins across navigation; r1 reached play and r2 was interrupted. Both raw traces remain in `instrumentation-attempt/`. The first GL transport attempt finished but reported an undefined service-worker registration because Playwright blocked registrations; its full ledger is retained. The corrected GL run uses the existing census transport `sw=0` together with blocked workers. These setup failures are documented, not hidden or used in the three-run result.

This interim pin includes G188 cold KTX2-first, on-demand dummies and view-distance B. Comparing directly with the earlier end-of-pose-only census would mix coverage; use the upcoming cut-2/3 repeat with this same protocol. No budget, content default or runtimeCost metadata is changed by this receipt.

## Reproduce

Serve a clean `42c50944c` export with `scripts/serve-build.sh --rev 42c50944c`. Run `node sim-bootstrap.mjs <owned-export>/dist/index.html <version.json build>` before native boot. Through `scripts/sim-lane.sh run --max 30 wildshard-iphone`, run:

```sh
node scripts/sim-memory.mjs --url=<preview> --out=<empty> --runs=3 --play=30 --fly=30 --shards=pine-hollow --setting=tex=auto --locations=on --device-save=debug.plugin.pine-hollow.pineMemoryTrim=on
```

After Simulator shutdown, through `scripts/browser-lane.sh --max 20`, run `node progress/memory/sf22a-pine-g187-42c50944c/location-gl.mjs <preview> <empty>`. `collect.py <scratch> <receipt>` preserves raw evidence and compresses repetitive full GL ledgers; `python3 aggregate.py` reproduces `summary.json`. `study.json` records the driver/source provenance.

All owned Simulator and browser resources are closed. The preview/export and throwaway scratch are removed after collection. The coordinator carries the evidence and sampler commit through the serialized green push; no separate builder push.
