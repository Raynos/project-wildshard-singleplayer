# Signal Dunes runtime measurement (SF50-g / SF22a, E435)

Source `744cf67ef347bd635ae8126cb80d5355a77fec85`, build `744cf67-muzj91re`. Three valid cold Safari runs from three attempts; zero failed attempts or lost WebContent PIDs. Auto textures, Memory saver on, Developer enabled for Explorer. Each play phase rotates for 30 seconds, then each Explorer phase flies W / D / S for 30 seconds. Three fresh iPhone 16 Pro Chromium/Metal contexts on the same source supply the labelled GL ruler.

| Phase | Native settled median (cold-run range), MB | Labelled GL, MB | Sum of medians, MB | Conservative phase peak sum, MB |
| --- | --- | --- | --- | --- |
| Play | 220.401 (210.931–222.449) | 133.399 | 353.800 | 386.899 |
| Explorer | 226.545 (221.597–231.657) | 133.399 | 359.944 | 368.899 |

The native loading interval high was 522 MB (rounded to 1 MB); no loading GL peak was collected. Settled loading median was 228.003 MB. Inspector play / Explorer medians were 305.623 / 311.624 MB, a separate ruler that is never added to native + GL. The conservative sum pairs the largest native interval high across runs, plus 0.5 MB for rounding, with the greatest observed GL bytes for that phase. All three GL contexts reconciled exactly, with zero unlabelled bytes and zero page errors. The play and Explorer peak was exactly 133,399,284 GL bytes in every context.

The whole opaque runtime metadata uses the median of the three settled play readings and matching GL. The dated 299 MB engine-base calibration in `progress/memory/sf22a-2026-10-04.json` was not remeasured. `(220.400664 + 133.399284 - 299) × 1,000,000 / 1.11`, rounded upward by the defining game helper, gives **49,369,323 accounted bytes**. The current playing model with its 300 MB base and 80 MB overlap reserve is 434.800 MB before any additional resident. Neither a computed cost nor a second calibration factor belongs in the shard declaration.

This is a standalone Simulator regression ruler plus a Chromium phone-tier GL proxy. It is not an entered-grid measurement, a physical-iPhone cap verdict, a frame-floor pass, a full-world walk or a Matriarch encounter measurement. The four-entry native proof and cold lit-save / respawn fixtures are separate evidence in `progress/shard-platform/sf50/README.md`. Grid discovery and browser/entered proof follow the measured metadata.

The historical native end census was corrected in `69afe33b5`: reading a released attribute's accessor restored CPU copies. The actual diagnostic expression now reads stored data descriptors and reports skipped accessors, without changing the phase timing or readings. Every run skipped 555 accessors at the end. Raw Inspector/kernel JSONL and GL ledgers are losslessly gzip-compressed; captures are JPEG. Identities, exact script/asset hashes, HTML-only harness injection and its original-hash restoration are in `provenance.json`. All owned Safari, Inspector, proxy, sampler and GL browser resources closed before the Simulator was released to the next lane.

```sh
scripts/serve-build.sh --rev 744cf67ef347bd635ae8126cb80d5355a77fec85 --name sf50-sun-cost
node progress/memory/sf22a-pine-g187-42c50944c/sim-bootstrap.mjs <owned-dist>/index.html 744cf67ef347bd635ae8126cb80d5355a77fec85
scripts/browser-lane.sh --max 12 node progress/memory/sf22a-runtime-homes-535780474/gl.mjs <preview> <empty-gl-output> sunscar-dunes on
scripts/browser-lane.sh --max 25 scripts/sim-lane.sh run --max 25 wildshard-iphone node scripts/sim-memory.mjs --url=<preview> --out=<empty-native-output> --runs=3 --play=30 --fly=30 --shards=sunscar-dunes --setting=tex=auto --setting=memorySaver=on
# Preserve every attempt, including failures; require three valid cold runs.
node progress/memory/sf50-sun-runtime-744cf67ef/summarize.mjs
```
