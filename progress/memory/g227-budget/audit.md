# G227 model versus measured residency audit (E435)

**No runtime discount is proved. Pine’s proposed RGBA texture charge materially overstates the ASTC GPU storage; Nalati’s current world textures in this run are not ASTC. Neither correction can be subtracted from the measured whole-runtime claims.**

Source pin `f47f33199`, desktop build `f47f331-muz4sw1c`: one cold, muted Chromium/Metal iPhone 16 Pro route, Developer ON, phone tier, Auto textures, 2× render scale. Real input entered Pine and then Nalati, with the previous opaque runtime retired; entry and centre were sampled. Zero page errors or console warnings/errors; all GPU census sums reconcile exactly. The simulator follow-up is pending after the serialized-push quiet window. Its first startup-only clock-quantization report is retained separately; no entered Simulator result is claimed here.

## What is actually measured

| Pose | Modelled playing MB | All labelled GL MB | All directly retained scene ArrayBuffers MB | Definite world GL MB | Definite world direct arrays MB | Definite world subtotal MB |
|---|---:|---:|---:|---:|---:|---:|
| pine-hollow-entry | 1082.195295 | 238.685862 | 73.335900 | 50.794912 | 19.968186 | 70.763098 |
| pine-hollow-centre | 1075.919348 | 236.545658 | 73.560276 | 51.884560 | 19.968186 | 71.852746 |
| nalati-grasslands-entry | 1070.886773 | 316.929220 | 112.189570 | 77.060256 | 50.632900 | 127.693156 |
| nalati-grasslands-centre | 1064.196295 | 313.435392 | 112.232110 | 77.060256 | 50.632900 | 127.693156 |

**The world subtotal is a lower bound, not an isolated process footprint and not a retirement credit.** Labels identify explicit terrain, forest/scatter and static props. Ambiguous generated meshes, shared resources, source/build caches, decoded native images and unassigned process cost remain residual. CPU arrays are deduplicated by ArrayBuffer identity; GL by resource identity. A texture shared with a retained creature/kit/sky role stays retained. Scene paths without unique names can be ambiguous. Direct arrays exclude native image/canvas storage; dimensions are recorded but not promoted to measured residency.

All region-connected direct arrays, including the retained kit/creatures/sky, are 58.989 MB Pine and 92.161–92.163 MB Nalati. This still excludes off-scene caches and native cost, so it is not an upper bound for W. The census cannot honestly conclude W <150 MB; it also does not prove the ~400 MB retirement needed by the current tile estimates.

## Top ten claim owners at entry

Accounted bytes include retained CPU and GPU; the model applies 1.11 once and adds its fixed 300 MB base and 80 MB overlap. GL is only one part of owner residency. The active-runtime GL column is a direct label/active-scene match, not an exclusive whole-runtime footprint. No GPU handle is a measurement of its CPU/native counterpart.

| Owner | Pine accounted MB | Nalati accounted MB | Pine matched GL MB | Nalati matched GL MB | Unmeasured / retained component |
|---|---:|---:|---:|---:|---|
| `sim:<entered>` | 500.839395 | 489.909910 | 92.270456 | 134.173628 | CPU/native/source caches not isolated |
| `platform:render:grid.open-plots` | 33.789972 | 33.789972 | 19.058694 | 19.058694 | Retained JS/canvas/arrays also charged; GL difference is not savings |
| `platform:render:road.signs` | 22.732832 | 22.732832 | 22.645660 | 22.645660 | Retained JS/canvas/arrays also charged; GL difference is not savings |
| `platform:render:road.deck` | 22.512656 | 22.512656 | 14.004668 | 14.004668 | Retained JS/canvas/arrays also charged; GL difference is not savings |
| `product:grid:_template` | 7.417076 | 7.417076 | — | — | Parsed source/wire CPU; no GPU owner |
| `sim:platform.highway` | 6.744192 | 6.744192 | — | — | Rapier/native physics; no GPU owner |
| `platform:render:cell-screens.slot-0` | 6.116694 | 6.116694 | — | — | 10.485732 MB GL across the 3-slot group; per-slot identity not exposed |
| `platform:render:cell-screens.slot-1` | 6.116694 | 6.116694 | — | — | 10.485732 MB GL across the 3-slot group; per-slot identity not exposed |
| `platform:render:cell-screens.slot-2` | 6.116694 | 6.116694 | — | — | 10.485732 MB GL across the 3-slot group; per-slot identity not exposed |
| `platform:render:road.junctions` | 5.629880 | 5.629880 | 5.618548 | 5.618548 | Retained JS/canvas/arrays also charged; GL difference is not savings |

At the centre, two screen slots remain and the third retires; the exact per-pose lists are in [label-summary.json](label-summary.json). All labels, including residual/retained roles, are in [labels.md](labels.md). No zero was substituted for an unknown owner total.

## KTX2: parser charge versus actual format

`parseKtx2` in `src/game/shardfile/assets.ts` explicitly returns the RGBA mip upper bound `sum(width_i × height_i × 4)` as GPU residency. It does not inspect the platform transcoder choice. The GL census records the actual sized internal format and mip/block bytes after upload.

| Same uploaded texture set | Actual ASTC GPU MB | RGBA mip upper MB | Upper / actual |
|---|---:|---:|---:|
| pine-hollow-entry — all ASTC | 37.421376 | 288.358248 | 7.706× |
| pine-hollow-entry — definite world ASTC | 22.025504 | 196.083632 | 8.903× |
| nalati-grasslands-entry — all ASTC | 9.722080 | 41.943000 | 4.314× |
| nalati-grasslands-entry — definite world ASTC | 0.000000 | 0.000000 | — |

Pine ground diffuse array: ASTC 6×6 sRGB `0x93d4`, 2.505152 MB actual versus 22.369616 MB RGBA (8.929×). Its normal array uses linear ASTC 6×6 `0x93b4`. Some creature coats use ASTC 4×4 (~4×). The 54 explicitly world-classified Pine ASTC resources alone have a **174.058128 MB** RGBA-minus-ASTC difference. That is a texture representation estimate difference, not an observed removal of current allocations.

Nalati’s definite-world GPU is 22.369600 MB textures +54.690656 MB buffers. **No definite-world texture is ASTC in this capture.** The 9.722080 MB of ASTC on the Nalati page is mostly retained Pine coat resources: 9.326816 MB still has Pine labels after Pine’s regional runtime retires. Those are retained cache/shared resources, not Nalati world retirement credit. The ~25.17 MB conservative Nalati tile texture allowance cannot receive Pine’s 8.9× factor.

The broader ASTC totals are not identical to an emitted dependency union: shared handles, array textures, component ownership and actual file-hash dedup must be reconciled by the product. [Pine’s estimate](../../shard-platform/pine-world/residency-estimate.md) is ~300 MB (250–350), [Nalati’s estimate](../../shard-platform/g227/nalati-residency-estimate.md) ~230 MB (200–270), both planning only. Nalati’s offline L1 candidate reduces ground by 3.525 MB but still exceeds the native ground representation; it proves no live retirement.

## Model implications

Current `sim:pine-hollow` (500.839395 MB accounted) and `sim:nalati-grasslands` (489.909910 MB) are derived from **measured WebContent + compressed-path GL**, with the dated 299 MB base removed and 1.11 undone once. They do not call `parseKtx2`. Therefore subtracting the 174 MB texture upper-bound difference from either current claim would be false accounting.

A format-aware tile admission policy can replace the RGBA upper bound only with a supported, enforced transcode target (including fallback behavior), exact block/mip byte accounting, actual content-hash union and retained CPU/staging bytes. ASTC/BC eligibility cannot be inferred merely from “KTX2”. Keep RGBA as the unsupported-device/fallback ceiling unless admission rejects that path. This audit makes no policy or budget change.

The fixed base/overlap and the opaque-runtime calibration need matched Simulator evidence before any correction. GL labels cannot assign the WebContent residual to a particular runtime owner, and the separate GPU-process RSS/footprint must never be added as a second GL total.

## Reproduction and evidence

- [census.mjs](census.mjs): run through `scripts/browser-lane.sh` against an owned `serve-build --rev f47f33199` preview. Arguments: base URL, output JSON.
- [census-f47f33199.json.gz](census-f47f33199.json.gz): complete raw route, claims, resources, subresources, direct arrays and source-image dimensions.
- [classify.py](classify.py): `python3 progress/memory/g227-budget/classify.py` reconciles every GPU/CPU group exactly and reproduces the tables. Classification rules are explicit; unknowns stay unknown.
- [native-origin-quantization.json.gz](native-origin-quantization.json.gz): first Simulator startup/route-stage refusal at a 1 ms timeOrigin change, before motion. Its home sample is provisional and not used to calibrate a component.

Plan-State: unchanged. G227/model calibration remain open; no positive net saving or cap pass is claimed.
