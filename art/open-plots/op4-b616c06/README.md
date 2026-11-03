# OP4 qualified batch — b616c06

OP4 is done: **3 plots × 8 domes × 9 views**, 24 labelled sheets, plus
four fixed ring-junction views. All 216 images/camera sources, 120 positive
real-draw clock samples per view and original acceptance guards were verified.
The standalone board-maker ran once over all three final plot receipts.
All 24 sheets and four junction images were inspected; media totals
5,897,151 bytes. [Full compact manifest](summary.json).

- [open-plot-night-market](open-plot-night-market/A1-road-stand/sheet-3x3.jpg) — eight sheets in this folder.
- [open-plot-lantern-bayou](open-plot-lantern-bayou/A1-road-stand/sheet-3x3.jpg) — eight sheets in this folder.
- [open-plot-showcase-template](open-plot-showcase-template/A1-road-stand/sheet-3x3.jpg) — eight sheets in this folder.

Junction views: [Pine](junction/pine-hollow.jpg),
[Night Market](junction/open-plot-nw.jpg),
[Thin Ice](junction/open-plot-1-4.jpg),
[Showcase](junction/open-plot-2-4.jpg).
The real road anchor is (-281.25,843.75), lattice(-0.5,1.5), eye height
1.70004 m. Every neighbour has actual drawn-layer, centre-frustum and owned
residency witnesses. Coverage is **across four 62-degree views**;
`allCentresInOneFrame=false`. This does not prove absence of occlusion.

## Source and provenance

Immutable app/camera source: `b616c06a02dfcf6d49a333ec35ad6a24a471c1d0`. Original18 domes use
`b616c06-mw0dyp5q`; only the six unfinished Showcase domes plus junction use
the necessary same-source rebuild `b616c06-mw0k33gx` after normal teardown.
Both full actual version receipts remain in the manifest. No completed dome
was repeated; all16 existing Night/Bayou board hashes reproduce exactly.
Bayou/Showcase cameras remain explicitly TEMPLATE; these captures approve no
new art direction. Showcase/Thin Ice placeholder imagery is retained honestly.
Older cfbc Bayou captures are historical, not reused in this source-bound set.

The original18/24 refusal, passive B1 refusal and first wait/read continuation
refusal remain unchanged under `tmp/sp-x9-op4/`. Original B1 failed only with
`pending=[pine-hollow]`. Tooling fixes `fb1920bee62e` / `92611f473e03` wait for
normal admission and return the actual ready snapshot in one browser task;
separate boolean-wait/later-read raced another optional admission. Pending is
never ignored. The original anchor, camera, context, residency and frame guards,
180-second readiness and 15-second/120-draw sample bounds remain. Pine and grid
runtime are untouched (G908). Separate HEAD591 attribution is recorded by X6
in `69decd4aa4`; it is not substituted for this b616 evidence.

Raw original: `tmp/sp-x9-op4/capture-b616`.
Raw final six+junction: `tmp/sp-x9-op4/continuation-b616-atomic` (EXIT0).
Offline verified assembly: `tmp/sp-x9-op4/final-b616`.
Full source/binding and per-file digests: `summary.json` and
`tmp/sp-x9-op4/atomic-continuation-binding.json`.

## Scope of the result

These are normal-entry Chromium/iPhone16Pro phone-tier2× captures, shipping
rings/LOD, original 62-degree dome camera method and no forced residency.
The CPU-only3211 build overlapped part of the first capture; scheduled gates
and a brief O3 boundary overlap are shared-host functional evidence. Counts,
FPS and page-process samples are descriptive, not an isolated speedup or an
OP23 physical-phone/frame-floor/memory/draw-budget pass. Both preview leases
were normally released and all owned browsers closed.

The general one-command capture and independent list board-maker are documented
in [CAPTURES.md](../../../scripts/open-plots/CAPTURES.md). `--domes` records an
explicit cause-directed continuation scope; the default still captures all8.
