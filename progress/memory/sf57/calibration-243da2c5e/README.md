# SF57 calibration, part 4: the ≈ 16 MB, measured (E435, sf57-qualify4, 2026-10-09)

The public soak `public-236c1225d` read (M − E) / A = 0.975–0.999 against the [1.01, 1.21] window: the allocator charged
≈ 16 MB more than the page holds at the settled home stop. This folder measures the two suspects named by
`calibration-1e428e7d7` and charges what was measured. The cap and the window are unchanged.

Probe: `calib2.mjs` → `calib2.json` (summary in `summary.json`). Clean `git archive` of `243da2c5e` served by
`scripts/serve-build.sh --head`; Chromium "iPhone 16 Pro", muted, Metal ANGLE; Settings ▸ Debug ▸ GPU textures `img`
(what the Simulator resolves: its KTX2 probe vetoes); labelled GL census 15 s after the reveal, grouped by label; the
allocator's claims from `grid.residency()`. Decimal MB.

## 1. The open plots charged two freed canvases (−12.98 MB)

`platform:render:grid.open-plots` claimed 33.79 MB: 14.71 JS + 19.08 GPU. The census finds the GPU half exactly
(picture atlas 13.11 + sign atlas 4.19 + buffers 1.73 = 19.03). The JS half charged both atlas canvases (12.98 MB) for the
page lifetime, but `openPlot.ts` shrinks each canvas to 1 × 1 once its final content is uploaded (the text atlas at once,
the picture atlas when every picture has settled). They are construction transients, which the cost model's overlap
allowance covers. The plan now charges the buffers plus the two remaining pixels; a failed picture no longer keeps the
picture canvas alive (it settles with its navy placeholder, so the charge is true on that path too).

The other l0 products match their GL: junctions 5.63 claimed / 5.62 GL, signs 3.16 / 3.08, asphalt 2.85 / 2.84; the road
deck's 17.74 is 10.88 GL plus its retained vertex and culled index copies (the engine's RAM attribution reads
`engine/scene` +7.7 MB on the public page). The "71 MB vs 45 MB of GL" gap was the deck's JS half (real) plus the open
plots' canvases (not resident).

## 2. Driftwood's home GL (−8.15 MB raw, −7.35 MB accounted)

The `DRIFTWOOD_RUNTIME_COST` row's GL half was 204.5 MB (desktop labelled census, fe508c172). The same method today, in
`img`: **196.35 MB** (identical to `calibration-1e428e7d7`'s 196.3 on `781e0bec3`). The row now carries 196.345073; its
WebContent half (473.878, Simulator, fe508c172) and `rev` are unchanged. WebKit cross-check: the Simulator's labelled
census reads the public home at 245.34 MB (soak `public-236c1225d`, settled c1–c4) against Chromium's 241.64 here
(+1.5 %), so the two censuses agree on this page.

## What it does to (c)

A at the 236c1225d settled stops was 454.09 MB; minus 12.98 and 7.35 it is ≈ 433.8. With that soak's M:
(M − E) / A ≈ 1.021 / 1.030 / 1.038 / 1.045 at c1–c4 (was 0.975–0.999). The qualifying soak after this change is the
check; this folder predicts, it does not grade.

## The circuit-1 spike (rule b), attributed from the 236c1225d raw samples

The 835.7 MB loop peak is a WebContent interval-high transient, not a resident: on the exit from template-2 onto the road
(cycle 1, t = 930 s) the game PID jumps +55.9 MB for one sample and 9 s later, on the road, +58.6 MB within one second
(interval-high 589.6 vs 531.0 sampled), both gone by the next sample. GL (246.0–246.8), the allocator (452 → 449) and the
residents (template-1/2/4) are flat across it, so it is **not** a double-held texture or an unreleased previous cell. The
same exit repeats it at a smaller size in cycle 3 (+34.4 MB at t = 1533 s) and under 15 MB in cycles 2 and 4: a JS/WebKit
garbage transient around the template-2 exit and the template-3 approach whose size depends on GC timing. The ≈ 32 MB
the footprint keeps until template-4's eviction at t = 956 s returns then. Not fixed here: the allocation site needs a
heap-sampled diagnostic run of that exit.

Plan-State: unchanged
