# Far Reach D229: clock-pinned endpoint comparison

Status: **closed**, G848 verdict by sp-o1 (Opus), G872 approval by
wildshard-new. View 24 was promoted from the settled `0bf578e89b` capture
in `112eed9039`. This measurement changes no renderer or shard content.

The requested `0d7a022fbb..c9ae94288f` endpoints both retain the pale veil
at noon. More decisively, the same immutable `c9ae94288f` build draws both
the veil and the clear bridge at the same 17:30 clock and camera. No first
source commit dropping the veil was established. Opus classified the
golden as a pre-refinement capture, rather than a regression or clock change.

## Panels and readings

Both boards contain actual iPhone portrait Chromium captures, resized only
for presentation, with source, native clock, frame and bridge ROI burned in.

- [G992 parent and both interval endpoints at noon](../../art/golden-runs/far-reach/d229-2026-11-04/noon-source-board.jpg).
- [17:30 endpoint comparison and same-source A/A](../../art/golden-runs/far-reach/d229-2026-11-04/golden-aa-board.jpg).
- [All eight original capture receipts and frame hashes](../../art/golden-runs/far-reach/d229-2026-11-04/receipts.json).

RGB means use sp-o1's raw ROI `(134,1504)..(715,1810)` in the
1206 × 2043 screenshots. These are descriptive measurements, not a pixel
tolerance or an exact-frame A/B qualification.

| Source | Clock | Native frame | Mean RGB | Observation |
| --- | --- | ---: | --- | --- |
| `a258c2941a` (G992 parent) | 12:00 | 374 | 172.1 / 162.6 / 144.5 | Veil |
| `0d7a022fbb` | 12:00 | 375 | 172.2 / 162.7 / 144.6 | Veil |
| `c9ae94288f` | 12:00 | 375 | 171.7 / 162.2 / 144.2 | Veil |
| `0d7a022fbb` | 06:00 | 375 | 162.8 / 149.4 / 130.1 | Veil |
| `0d7a022fbb` | 17:30 | 375 | 167.9 / 157.0 / 138.6 | Veil |
| `c9ae94288f` | 17:30 | 555 | 124.4 / 93.3 / 66.0 | Clear |
| `0d7a022fbb`, A/A | 17:30 | 375 | 169.3 / 158.8 / 140.5 | Veil |
| `c9ae94288f`, A/A | 17:30 | 375 | 170.6 / 160.6 / 142.4 | Veil |

The previous SHARDFILE golden (`592dc655ea`, captured on `0d7a022fbb`)
measured 171.8 / 162.9 / 144.9 in its labelled 540 × 937 image, ROI
`(60,690)..(320,830)`. The historical c9 clear screenshot measured
125.0 / 94.3 / 67.2 in the raw ROI; its actual native clock was not recorded.
Those historical images are references, not clock-bound causal witnesses.

## Method and limits

All three source revisions were ordinary immutable `serve-build.sh --rev`
builds. The earliest revision actually built and captured in this comparison
is `a258c2941a62468e19a64f55f613b54fa97f5ccb`, before G992. Thus the earlier
presumed `793ceb58` historical-build cutoff does not bound this comparison.
No earlier revision's failure is inferred from another lane's receipt.

Captures used `browser-lane.sh`, muted Chromium/Metal, iPhone 16 Pro,
phone tier, 2× render scale, seed 357, Shardfile entry, clear weather and
only Far Reach camera 24. The maintained golden capture reader's normal
120 frames, residency/network settle, 60 live frames and final held renders
were retained. All eight runs completed with idle/live settled and no page
errors. The clear c9 run's idle settle took 7.667 s, versus approximately
1.66 s in the other runs, and naturally reached frame 555 rather than 375.
The reader's settled flags alone therefore did not imply equal refinement.

The scratch reader changed import paths for its scratch location and added
an explicit native clock pause/set after entry, before the unchanged frame
sequence. It checked the requested hour and preserved `clock.pinned=false`.
It did not call `clock.hold()`, update the sky manually, reset the culler,
force residency, alter geometry or add frames to obtain a preferred image.
The two final A/A observers also recorded equal native key direction,
fog uniforms, fog near/far and hemisphere light across the two sources.
Far Reach's painted key is fixed and differs from the clock's moving sun.
Neither clock values nor those equal lighting fields establish a clock cause.

Two preliminary diagnostics, `left-noon` and `left-golden`, used native
`hold()` and a manual sky update. They changed pinned-light state and are
excluded from the causal evidence, tables and boards. The retained receipt
manifest identifies that exclusion and hashes the maintained/scratch readers.
An initial clock-only interpretation was withdrawn after the final A/A pair.

The parent was captured only at noon; the full two-clock endpoint comparison
is on `0d7a022fbb` and `c9ae94288f`. Refinement is the Opus visual verdict,
not an independently instrumented attribution to a particular renderer pass.
No intermediate source bisect was credited after the newer endpoint itself
reproduced both states at equal clock. No new visual fix was proposed.

Raw receipts, exact commands, build logs, source reader and excluded
diagnostics remain under `tmp/sp-x8-d229/`. The committed receipt manifest
retains the source/build, actual camera/clock, settle/frame observations and
original PNG SHA256 for every credited capture. The D229 plan row carries
the verbatim G848 verdict and the coordinator's G872 closure.
