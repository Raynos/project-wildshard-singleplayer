# Driftwood both-cuts grid decision evidence (SF22a / G144, E435)

**Verdict: fits the current-content admission model.** With GPU-only geometry copies and island instancing both ON, every cold reading fits both the ordinary and developer 3×3 layouts. The tightest conservative result is **981.473 MB**, leaving **18.527 MB** below the unchanged 1,000 MB playing cap. This is a Simulator/home + labelled-GL composition model; it is not a physical-iPhone pass or an actual fully metered grid play test.

No Debug default, budget or runtimeCost was changed. The existing default-path metadata remains 606.097 MB native + 282.4 MB GL; the current admission owner continues to use that baseline. This study supplies the case for a later authorized change after the project's physical-device proof.

## Measurement

Clean revision `2226f2815c7f920879e59e6a8e90f930c262f113`, served build `2226f28-muuja9au`. Sampler `356032992`; iOS 26.5, iPhone 17 Pro Simulator Safari. Six independent cold origin resets / Safari restarts under one sim-lane: three hybrid OFF then three ON. Both cuts ON throughout. Each run played 30 s and flew Explorer 30 s; phase results are medians of three one-second native/Inspector samples. The tables summarize the **three cold-run medians**, with no outliers dropped. All six build/shard/device picks and all 18 native phase-peak checks passed.

The Simulator shut down before the two fresh Chromium/Metal GL probes, iPhone 16 Pro 390×844@3, 15 s settle + 10 s sampling. GL includes buffers, textures/full mip chains and renderbuffers; GPU-process RSS is kept in the raw report but never added as labelled GL.

| Hybrid | Native play MB (cold min–max) | Labelled GL MB | Play native + GL MB | Explorer native + GL MB |
| --- | ---: | ---: | ---: | ---: |
| OFF | 480.546 (475.828–482.447) | 205.1 | 685.646 (680.928–687.547) | 693.805 (688.530–696.361) |
| ON | 507.072 (494.669–534.237) | 204.5 | 711.572 (699.169–738.737) | 703.315 (691.731–706.903) |

Hybrid ON has a 39.567 MB native-play cold spread. The highest ON play reading falls in Explorer, so the capacity check retains that high reading; it is not diagnosed as retained-object leakage. JS-held geometry at Explorer is 58.274 MB OFF / 57.988 MB ON plus 15.101 MB instancing arrays in every run. Inspector readings remain separate in summary/raw JSONL.

## Full admission ledger

The reproducible [probe](admission-model.mjs) runs against the same clean source tree. It uses the actual `runtimeAccountedBytes`, `ResidencyAllocator`, profile readers, generator, six road byte-plan builders, `leaseClientLibrary`, `productResidentBytes`, and `RenderRings`. It creates each template bodyless regional host, installs that cell's actual strip duplicates, four socket backstops and creature borders, and measures its immutable native basis before disposing it. Regional admission includes the new 4,096-byte border charge (`e06a441738`). Each native basis has its own claim. Production durable-only continuation cache is zero.

The dated 299 MB engine measurement is subtracted once, and the allocator applies its unchanged 1.11 resident factor once, plus its 300 MB base and 80 MB overlap. Shared immutable assets are charged once; per-instance guest/view allocations remain separate. Opaque home render/library/sim are already inside the measured aggregate and are not charged twice.

The conservative bound retains all eight actual far parents, the three heaviest admitted template regional sims+bases beside home, every currently required product/library/edge claim, the 32 largest actual L1 tiles and the 40 largest actual L0 tiles. This overbounds one camera's tile set. Ten cost-only ring poses per layout include both corner templates, road junctions, U-turn and return; all 40 poses become ready with zero refusals. Ring ports do not allocate renderer meshes or drive a capsule; they verify the scheduler's real claim choices.

| Hybrid | Layout | Home/road/far + data MB | With three regions MB | Full tile bound MB | Median margin MB | Highest cold bound MB | Tightest margin MB |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| OFF | Ordinary | 852.970 | 916.255 | 925.749 | 74.251 | 927.650 | 72.350 |
| OFF | Developer | 859.495 | 922.093 | 931.033 | 68.967 | 932.934 | 67.066 |
| ON | Ordinary | 875.795 | 937.999 | 947.493 | 52.507 | 974.658 | 25.342 |
| ON | Developer | 882.836 | 945.369 | 954.308 | 45.692 | 981.473 | 18.527 |

The six real platform parts account for 44.161 MB ordinary OFF / 41.803 MB ordinary ON and 55.677 / 53.707 MB developer. Full per-claim ledgers, native basis sizes, all cold substitutions and pose costs are in [OFF model](hybrid-off/model.json) and [ON model](hybrid-on/model.json). The cold high ON developer result leaves only 18.5 MB, so this is limited headroom, not capacity for future content.

## Limits and verification

- Pine/Nalati and other opaque neighbours remain far proxies; their future fully resident M3 runtimes are outside this fit result.
- Developer Far Reach's committed `terrain.bin` is missing (404), so the existing profile reader uses a closed flat edge. The model records this exact fallback; both generator runs succeed without a whole-platform fallback. It is an existing edge-data limitation, not silently repaired for the test.
- Simulator native footprint is relative evidence. Labelled desktop GL is rounded to 0.1 MB. This ledger reproduces current admission claims, rather than independently measuring the whole grid's actual native/GPU-process resident memory. The engine-base calibration is dated, not remeasured.
- The two cases are grouped OFF then ON; this is not randomized cross-pin attribution. All cold runs and settling spreads remain in [summary.json](summary.json).
- Clean-pin `pnpm exec vitest run test/grid-road-bytes.test.ts`: **4/4 passed**, 14.64 s; existing plan-equals-measured and rollback/refusal assertions retained. [Log](byteplan-test.log). Both model processes exit 0 and release all native hosts/library/core/ring leases.

## Reproduce

Build `2226f2815` with `scripts/serve-build.sh --rev 2226f2815` from your scratchpad. Run the commands recorded in [summary.json](summary.json) under sim-lane and browser-lane. After the two GL probes, `python3 aggregate.py <this-study-directory>` rebuilds raw measurement summaries and model inputs (the checked-in summary additionally includes this receipt's ledger/validation metadata). For each case:

```sh
node --experimental-transform-types --import <clean-tree>/scripts/bake-loader.mjs admission-model.mjs --tree=<clean-tree> --input=hybrid-off/model-input.json --out=hybrid-off/model.json
```

Use `hybrid-on` for the second process so its page-level sea/Debug pick is fresh. The canvas 2D context is stubbed only in the Node planner; actual geometry builders and array sizes run. The four byte-plan fixtures verify the real retained CPU/GPU plans. Native/Inspector JSONL, cold plans/reports/tables, GL JSON and exit codes are preserved; sampler screenshots/phase scratch files were discarded.

Owned measurement browsers and Simulator closed before reporting; preview and scratch cleanup recorded in summary.
