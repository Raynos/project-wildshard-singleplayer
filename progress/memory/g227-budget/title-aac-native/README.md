# Bounded title AAC: failure-inclusive native A/B (E435)

**Full-title decoding is avoided; reliable whole-page native saving is not established.** The isolated Pine-centre WC + labelled GL medians are **1163.671 → 1152.432 MB (−11.239 MB)**, with overlapping ranges **1162.768–1187.625 / 1098.791–1170.356 MB**. Both medians remain above the 1000 MB playing cap. No runtimeCost change, admission discount or native saving credit follows.

Baseline: **3 valid / 3 game boots, 0 game failures**. AAC: **3 valid / 4 game boots, 1 GPU-process restart**. The candidate has the higher observed failure fraction (1/4 vs 0/3); this small cohort cannot assign cause. Both builds predate the compressed-array warm-up fix, and the coordinator's independent GPU investigation also reproduced native ANGLE compressedTexSubImage3D crashes on an old non-AAC build. That context does not erase the candidate failure. All attempted boots and the failed original-document diagnostic are retained.

## Isolated source and measurement

- Before: `96498873272ca4dc55129633693d648dac008512`, build `9649887-muzejvz8`. It is the earlier `0e6d69988` runtime plus the title/sting retirement Music/preload change. Thus this pair measures **additional bounded AAC**, not the earlier 27.8 MB live-PCM retirement.
- After: private candidate `80997ab8f1f496bcf39a69d1311252d0c690f8f6`, build `80997ab-muzek7yh`. Exact before tree plus **only nine audio files** from `39433e40772ef1764cffbe66275c26c0196ac3f9`. [Source provenance](provenance.json) records both trees and every changed blob; [pair.json](pair.json) lists the paths. No preload, geometry, texture, sky or platform cut is mixed in.
- iOS Simulator `wildshard-iphone`, phone tier, Auto textures, 2×, Developer ON, Memory saver ON, volume 0, seed 357. Each boot clears prior site/service-worker state and gets fresh Safari; one muted browser and one Simulator through their lanes. Same Driftwood home → Pine entry → Pine centre route. Each settled pose uses **three fresh timestamps from one fixed WebContent PID**, plus same-pose reconciled labelled GL (unlabelled=0). Per-boot WC is the three-sample median; the cohort median is across valid boots. Decimal MB. Failed partial poses never enter either median.
- The native live AudioContext is **interrupted, currentTime=0, 48 kHz** at every valid pose. This is an allocation measurement, not an audible-playing test. The separately recorded running-clock loop/fade/bar-handoff and six-second-stall proofs remain [sample-exact](../title-streaming.md).
- No GC, heap snapshot, forced restoration or continuous GL mutation journal during native sampling. The default phase sampler is unchanged; the SF57 per-interval-high opt-in is absent. Raw journals retain loading/high-water context; the table uses settled WC, not a stale phase maximum plus later GL.
- Rounds 1/2 were before the shared Simulator queue pause; the continuation ran later in the same day. The frozen continuation observer is the **exact GL_INIT in both saved round-2 injected pages** (blob `89ae989dd45bbb22ee3c786b52c0c9acdd9d4577`). The precise first-round observer blob was not captured. [Observer provenance](injected-gl-provenance.json), [continuation hashes](continuation-harness.json) and the [compressed helper sources](frozen-harness-manifest.json) preserve this limitation. No source/runtime pin changed during the pause.

## Every attempted game boot

| Attempt | Result | Home WC + GL MB | Pine entry WC + GL MB | Pine centre WC + GL MB |
|---|---|---:|---:|---:|
| before-1 | valid | 765.457 | 1137.994 | 1187.625 |
| before-2 | valid | 707.867 | 1135.173 | 1162.768 |
| before-5 | valid | 762.393 | 1019.401 | 1163.671 |
| after-1 | valid | 734.098 | 986.452 | 1152.432 |
| after-2 | GPU restart; invalid | 712.700 (excluded) | — | — |
| after-3 | valid | 733.770 | 1031.852 | 1170.356 |
| after-4 | valid | 735.998 | 1006.031 | 1098.791 |

`after-2` ended with the original life reason **“graphics recovery: the GPU process restarted: every canvas was wiped”**. The original document token disappeared; the driver refused the replacement root page (`80997AB · RELOAD`) rather than retrying its route. Last native fixed-PID peak was 838.717 MB; no matching failure-time GL sample exists, so it is not added to stale home GL. [Original failed report](raw/after-2.json.gz) and journal remain intact. Subsequent successful attempts use distinct filenames; the failed home reading is excluded throughout.

Two additional **infrastructure starts**, numbered `before-3` and `before-4`, failed during Node module resolution **before browser launch** (missing `ws` link, then missing copied `soak/owned.mjs`). They produced no game boot or native measurement. Both original logs and the [infrastructure record](infrastructure-failures.json) are retained separately from the seven game boots. The link/import closure was corrected before `before-5`. A scratch validator also initially mistook the existing string `"[]"` error census for an error; it was corrected without rerunning or replacing `before-1`.

## Valid-run medians and spread

| Pose | Side | WC median MB | GL median MB | WC + GL median MB | Combined min–max MB | Combined spread MB |
|---|---|---:|---:|---:|---:|---:|
| home-settled | before | 566.218 | 196.175 | 762.393 | 707.867–765.457 | 57.590 |
| home-settled | after | 537.923 | 196.175 | 734.098 | 733.770–735.998 | 2.228 |
| pine-hollow-entry | before | 886.755 | 248.418 | 1135.173 | 1019.401–1137.994 | 118.593 |
| pine-hollow-entry | after | 761.107 | 244.925 | 1006.031 | 986.452–1031.852 | 45.400 |
| pine-hollow-centre | before | 918.000 | 245.672 | 1163.671 | 1162.768–1187.625 | 24.857 |
| pine-hollow-centre | after | 906.760 | 245.672 | 1152.432 | 1098.791–1170.356 | 71.565 |

Home combined median is lower by **28.295 MB**; centre is lower by **11.239 MB**. Entry is lower by **129.142 MB**, including a **3.493 MB GL** difference from pose-dependent/camera-attached buffers. This far exceeds the ~20 MB title payload hypothesis and is not attributed to AAC. The broad entry/centre spread, pause and higher candidate failure fraction prevent turning these observed medians into a dependable whole-page saving or fit claim.

## Confirmed allocation mechanism

Every valid baseline home reports exactly one full piano title decode: **2,989,920 stereo frames, 23,919,360 PCM bytes**. Its weak history later reports it retired. Every valid AAC pose reports **zero full-title decode events**, while other full decode identities remain visible. The bounded source instead prepares twenty short windows / **3,849,984 bytes** in the actual-source proof (~20.069 MB less than this native full-title payload, excluding native codec internals/transients). No equal reduction in WC is assumed. Mac reference decoding reported 23,920,672 bytes because its trailing-frame output differs; those two full-buffer sizes are not conflated.

Eligibility remains Memory saver ON, unpaired track, integral sample loop cuts, native AAC and a 48 kHz live context. Paired/fractional/unsupported/non-48k playback keeps the original path. Exact output proofs include 6,921,608 actual Music/Deck samples, 12,514,344 scheduler samples and 686,400 deliberate-stall samples with max/RMS difference 0. The previous full suite and source checks are recorded with the [activation receipt](../title-streaming.md); this commit adds evidence only.

## Reproduce and verify

Materialize the before tree, then replace only the nine [listed paths](pair.json) from the reachable activation source to reconstruct the after tree; verify both tree/blob IDs in [provenance.json](provenance.json). Build each isolated pin through `serve-build`/the build lane. Recreate the helper tree from `frozen-harness/` (decompress each `.gz`, retaining its path), provide its ordinary `ws` package, and run from the repo so the native sampler resolves correctly:

```sh
scripts/browser-lane.sh --max 15 scripts/sim-lane.sh run --max 15 wildshard-iphone   node <frozen-helper>/progress/memory/g227-budget/native.mjs   http://127.0.0.1:<port>/ <unique-output.json> <isolated-dist> pine-centre on
```

Stop each browser/Inspector/proxy/sampler before handing over the Simulator. All seven measured attempts have `closed=true`, sampler exit 0; final verification showed **sim0/1, browser0/4**, no owned native child, and both owned previews were stopped by their registered ports. No other lane's server was stopped.

[summary.json](summary.json) has exact bytes, per-side counts, all valid poses and the failure diagnostic. [raw-manifest.json](raw-manifest.json) hashes every raw and gzip artifact. The 52 artifacts compress 39,531,535 raw bytes to 1,743,187 bytes; all 26 pre-continuation hashes remain unchanged. Run `python3 progress/memory/g227-budget/title-aac-native/verify.py` to verify decompression, original-artifact immutability, counts, settings, title identities and independently recomputed cohort medians/ranges.

Plan-State: unchanged. Bounded AAC is landed behind Memory saver; this cohort is complete, native saving credit remains **0**, and G227 remains open.
