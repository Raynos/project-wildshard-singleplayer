# Nalati panorama source lifetime: no native saving credited

Three cold Simulator Safari runs per side, interleaved BEFORE / AFTER, on 2026-10-08.
BEFORE is `0e6d69988`; AFTER is tree `7f263d646ff4996a88127029fdc8155055305413`.
Its only runtime differences are the Nalati private panorama upload callback, the documented
`releaseOnUpload` public export and its source comment. Memory saver is explicitly ON.

Each run visits home, Nalati entry, Nalati centre and the neutral road. Each pose has three fresh,
increasing native timestamps from one fixed WebContent PID. All six runs closed their browser,
Inspector, proxy and sampler; all report zero game errors and sampler exit 0. No failed sample was
retried or substituted. The previous failed AFTER using the old sampler remains rejected.

At centre, every BEFORE retains the exact `sky-dome-v2` panorama as an ImageBitmap; every AFTER
retains only its dimensions. The source has 4,128 × 758 × 4 = **12,516,096 decoded pixel bytes**
(12,516,128 bytes including the measured owner header). The panorama's labelled GPU allocation
stays **16,683,348 bytes**. This is source-lifetime evidence, not a native-footprint saving.

| Nalati centre, decimal MB | BEFORE median | BEFORE range / spread | AFTER median | AFTER range / spread |
| --- | ---: | --- | ---: | --- |
| WebContent native footprint | 822.628 | 812.847–844.665 / 31.818 | 846.450 | 831.312–915.673 / 84.361 |
| Labelled GL allocations | 292.893 | 292.893–292.893 / 0 | 292.893 | 291.804–292.893 / 1.089 |
| Native + labelled GL proxy | 1115.521 | 1105.739–1137.557 / 31.818 | 1139.343 | 1123.115–1208.565 / 85.450 |

**No native saving is credited.** AFTER centre native median is 23.822 MB higher and its spread
is wider. Home variation is already large before Nalati loads. Earlier runs overlapped local gates,
a suite or a preview build; start-of-run activity is preserved in [six-cold.json](six-cold.json).
One AFTER centre has 1.089 MB fewer camera-attached mesh buffers; that difference is not attributed
to the panorama cut. The GL proxy is an allocation census, not a separate kernel footprint.
These Simulator readings do not prove the physical iPhone's memory caps.

Command, with the per-side URL, DIST and fresh output path:

```sh
G227_NATIVE_DETAIL=1 scripts/browser-lane.sh --max 15 \
  scripts/sim-lane.sh run --max 15 wildshard-iphone \
  node progress/memory/g227-budget/native.mjs URL OUT_JSON DIST nalati-route on
```

The corrected `4358c0f55` sampler contract is used throughout. The compact receipt includes
per-run build ids, fixed PIDs, all original sample timestamps, per-pose medians, source witnesses,
raw report SHA-256 hashes and machine activity. The next approved Nalati candidate avoids allocating
the unseen static kurgan mesh until entry; it has no measured saving yet.
