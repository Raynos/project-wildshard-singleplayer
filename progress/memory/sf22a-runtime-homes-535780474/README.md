# SF22a — Sky Reach and Nine Dragon reviewed home costs

Source pin `5357804745121cdda8f9492b62d3266244f4ac1b`; E435. Three cold Safari runs per shard, then three fresh iPhone 16 Pro Chromium/Metal contexts on the same source. Auto textures and shipped defaults; Developer is enabled only for Explorer. Play rotates for 30 s; Explorer flies W / D / S for 30 s. No capture-location or full-shard walk coverage.

| Shard | Native play median (range), MB | Play GL, MB | Play combined, MB | Explorer native median (range), MB | Explorer GL, MB | Explorer combined, MB |
| --- | --- | --- | --- | --- | --- | --- |
| far-reach | 271.0 (254.8–277.8) | 267.7 | 538.7 | 278.4 (261.0–281.5) | 310.7 | 589.1 |
| nine-dragon-stack | 399.2 (332.2–402.4) | 278.3 | 677.5 | 409.0 (341.3–411.5) | 321.4 | 730.5 |

| Shard | Conservative play/Explorer upper bound, MB | Margin under 1,000 MB | Native loading peak, MB (cap 1,800) | Play / Explorer Inspector medians, MB | Accounted home bytes | Modelled playing, MB |
| --- | --- | --- | --- | --- | --- | --- |
| far-reach | 716.2 | 283.8 | 469.0 | 647.3 / 603.0 | 215,953,384 | 619.7 |
| nine-dragon-stack | 760.9 | 239.1 | 782.0 | 608.3 / 663.0 | 340,966,245 | 758.5 |

**Verdict:** both measured standalone homes fit the 1.0 GB combined proxy; neither needs a budget increase. The grid must still admit the road and other residents independently. The model includes its 300 MB engine base and 80 MB overlap reserve. This is Simulator relative evidence plus same-pin phone-tier GL, not a physical-iPhone verdict.

The upper bound pairs the greatest native interval high across runs with the greatest GL allocation for that phase. Native summary peaks are rounded to 0.001 GB, so the bound adds 0.5 MB rather than claiming false precision. GL is reconciled byte-for-byte with zero unlabelled resources and zero page errors in all six completed contexts. Inspector is a separate ruler; it is not added again to native + GL. No loading-phase GL peak was collected.

The runtime metadata uses the median of the three settled play medians plus the matching play GL. Engine calibration remains the dated 299 MB reading in `progress/memory/sf22a-2026-10-04.json`; it was not remeasured. `(native + GL - 299) / 1.11` is derived only by the game helper, never stored in the shard declaration.

Two preliminary GL waves stopped on Nine Dragon’s 288-byte background-cube buffer because the source received its label after upload. `932576d0a` fixes the census only, using weak references; counts and resource identity are unchanged. The original refusal and partial wave records remain as diagnostics. The final wave resolves it as `engine/draw / generated/BackgroundCubeMaterial/position`. Native and GL exports have different timestamped build ids but identical source SHA; identities and HTML-only harness injection hashes are retained.

## Reproduction

```sh
scripts/serve-build.sh --rev 5357804745121cdda8f9492b62d3266244f4ac1b --name sf22a-runtime-homes
node progress/memory/sf22a-pine-g187-42c50944c/sim-bootstrap.mjs <owned-export>/dist/index.html 5357804745121cdda8f9492b62d3266244f4ac1b
scripts/sim-lane.sh run --max 40 wildshard-iphone node scripts/sim-memory.mjs --url=<preview> --out=<empty-sim-dir> --runs=3 --play=30 --fly=30 --shards=far-reach,nine-dragon-stack --setting=tex=auto
# After Simulator shutdown; use census helper 932576d0a or newer.
scripts/browser-lane.sh --max 20 node progress/memory/sf22a-runtime-homes-535780474/gl.mjs <preview> <empty-gl-dir>
node progress/memory/sf22a-runtime-homes-535780474/summarize.mjs
```

Raw Inspector/kernel JSONL and GL ledgers are losslessly gzip-compressed in this receipt. `summarize.mjs` reads the compressed records directly. End captures are Safari Explorer, JPEG ≤500 KB. All owned resources were closed before reporting. Concurrent socketlift work after this SHA is outside this measurement.
