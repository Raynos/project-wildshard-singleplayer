# Driftwood grid memory, 2026-10-14

The admitted phone-tier road entry reports 1,058.40 MB playing. Its
334,435,201-byte Driftwood runtime claim still comes from the older
fe508c172 native calibration. This change fixes storage, not that claim;
the same-method native recalibration is the next step.

## Resident inventory before the fix

Existing scalar memory attribution, decimal MB; GPU storage and retained
RAM buffers/images are separate from physical WebContent footprint.
Fresh muted Chromium/Metal, portrait phone tier, genuine neutral-road
entry into Driftwood. The dynamic neighbouring loads explain small
inventory variation between captures.

| Owner | RAM MB | GPU MB |
| --- | ---: | ---: |
| Engine render targets | 0 | 224.336 |
| Decoded piano audio | 61.204 | 0 |
| Driftwood regional scene | 28.548 | 29.458 |
| Driftwood world scope | 42.543 | 2.612 |
| Physics | 26.477 | 0 |
| Grid loading screens | 7.864 | 10.486 |
| Grid deck | 3.235 | 13.424 |
| Shore rocks | 8.623 | 6.467 |
| Unattributed | 4.429 | 6.144 |
| Cove small rocks | 4.497 | 4.497 |

## Warm-up shadow storage

Precompile's detached lights made their own shadow maps. Exterior and
future-light jobs never released those targets. Warm-only lights now
borrow live shadow maps without updating them. Any privately made maps
are released in the warm's finally path, including cancellation. Neither
the real lights, their maps nor their shadow update cadence are changed.

In-page GL storage fell 353,213,404 -> 185,441,244 bytes, a reduction of
167,772,160 bytes. The 1024-square warm-map attachments fell from 42 to 2.
Program counts stayed 212 immediately after entry and 212 after 60 real
entered frames in both captures. The phone entry video shows no first
frame hitch; the coordinator approved the entry view. Nineteen focused
behaviours, including all seventeen headless shards, passed.

Control build bbc82f6fd; candidate fa2c50f60a (parent 5a3d10a90).
The intervening changes add an unused graph batch API, model discovery,
and material lending; this is a storage/variant observation, not an exact
image comparison. The later type annotation fix erases at compilation.
GPU deltas are observed storage, not a claim of physical-phone RSS.
