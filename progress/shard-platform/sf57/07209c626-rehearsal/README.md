# SF57 Simulator rehearsal — 07209c626

**FAIL / incomplete rehearsal. SF57 remains open.** This pin predates the required SF46/47/48-g and dev SF49/50-g
prepared conversions. It neither closes the memory gate nor establishes WebKit retention. SF57b's planned build stays default-off.

Two fresh iPhone 17 Pro Simulator Safari devices, one machine-wide via `sim-lane`, ran at live clock and 2× scale.
Each drove 1,800 real seconds in one document, completed two circuits and visited all 16 crossroads. One initial
road pose; subsequent movement used the real controller. Production eviction only; no reload, GC, budget override
or manual eviction. Final full unload occurred in the same document. Both previews/proxies/devices were closed.

| Reading / requirement | Shipped | Full dev (Developer + DEVSERVER) |
| --- | ---: | ---: |
| Duration | 1,800.004 s | 1,800.015 s |
| Actual admitted cells / attempted | 6 / 9 | 3 / 9 |
| Natural regional resident removals | 22 | 0 |
| Observed combined playing peak | 1,248.123 MB | 1,470.283 MB |
| Observed combined loading peak | 1,086.925 MB | 1,128.902 MB |
| Loop 2 → partial loop 3 peak change | +11.013 MB | +31.409 MB |
| Loop 2 → partial loop 3 trough change | +2.350 MB | +7.308 MB |
| Peak/trough within ±30 MB | Yes | No |
| Maximum adjusted settled ratio | 7.240 | 8.110 |
| Raw settled measured / accounted (informational) | 10.129 | 11.013 |
| Native readings missing a GL pair within 1.5 s | 10 (3 loading, 7 drive) | 7 (4 loading, 3 drive) |
| Disposal errors / context losses / WebContent PID losses | 0 / 0 / 0 | 0 / 0 / 0 |
| Leaked scoped resources / bodies / colliders | 0 / 0 / 0 | 0 / 0 / 0 |

MB is decimal. Combined = all Simulator WebContent `phys_footprint` (with kernel interval highs for peaks) + labelled
live GL API allocations. GPU-process footprint is separate and never substitutes for GL. Every captured GL census
reconciled with zero unlabelled resources. Peaks are **observed complete-pair maxima**, not complete bounds: GL-sampler timing gaps during
boot and driving left 17 missing GL pairs, which refuse sampling and the gate; no interpolation or fabricated readings.
The playing cap is 1,000 MB; loading is 1,800 MB. Calibration gates `(combined − 300 MB engineBase) / accounted ≤ 1.11`.
The ×1.4 phone estimate in the JSON is informational; these are Simulator readings, not physical-phone verdicts.

Shipped admitted `template-1` … `template-6`; Pine Hollow, Driftwood and Nalati remained refused. Dev admitted
`template-1`, `template-2`, `template-4`; Pine Hollow, Sunscar Dunes, Driftwood, Nalati, Far Reach and Nine Dragon remained
refused. A far proxy was never counted as entry. Dev's three admitted regions stayed resident under production policy;
no artificial unload was used to create an eviction witness.

The combined cap and calibration fail. Dev's observed peak growth also exceeds 30 MB, and it lacks natural regional
eviction. Missing GL pairs and unprepared runtime cells prevent a qualifying verdict. No JS heap snapshots or Rapier
memory readings were captured, so the result does **not** attribute growth to WebKit or justify enabling fade-reload.
Before the qualifying rerun: prepare the conversions, fix continuous GL capture through synchronous stalls, and account
for the transitional page-owned home. Investigate retained product data with heap/WASM/GL evidence if growth persists.

The original worker JSONs are preserved: their grader printed non-finite peaks as `null`, and incorrectly called the
unchanged engine event baseline (7 listeners, 5 answerers before **and** after) a leak. `d7e72fac6` / `0af5f676a` correct
that comparison and require all scoped counters to clear. [summary.json](summary.json) regrades the identical raw readings;
its missing-pair list and raw-file SHA-256 hashes make the correction reviewable. CSVs retain unmatched GL as blank.

```sh
node scripts/soak/soak.mjs --prepare --rev=07209c626 --out=<scratch>
# After the explicit coordinator go: create the printed GO file.
node scripts/soak/report.mjs --from=<completed-run> --out=<evidence-directory>
pnpm exec vitest run test/sf57-soak.test.ts        # 7 / 7
node --test scripts/soak/drive.test.mjs scripts/soak/gl.test.mjs  # 2 / 2
pnpm exec oxlint scripts/soak/*.mjs scripts/soak/route.ts test/sf57-soak.test.ts
```

The complete one-second native and labelled allocation logs are losslessly Brotli-compressed (`*.jsonl.br`, under
300 KB total instead of ~500 MB raw). Decode with Node's `brotliDecompressSync`; each raw hash/length was verified.
The source pin and exact build fingerprints are in both original receipts. No raw reading was changed by regrading.
