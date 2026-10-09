# Handoff (sf57-qualify) — 2026-10-08, lane sf57-qualify2

## Landed
- `933205df4` (first lane): a re-entered borrowed Driftwood home keeps one copy of its play installs (go-B).
- `f05a45712`: 933205df4 broke boot smoke's grid case ("Scene subtree requires one live owner": a grid view already owns
  each registered piece's object). `ownEnteredTree` now leaves a view-owned object to its view. Boot smoke 3/3 PASS.
- `1e428e7d7`: the residuals. Maren + her counter are entry-owned (they were the +2 colliders / +2 pieces per entry);
  bootstrap's `moving` / `player.platforms`, `place()` records + cullers and `registry.picks` leave with an owner shorter
  than their world. Re-entry witness: colliders 2299 and pieces 92 flat at every home stop; JS heap plateaus at 222 MB.

## Calibration: attributed, not fixed
`progress/memory/sf57/calibration-1e428e7d7/README.md`. The allocator charges ≈ 118 MB too much at the public home:
the neighbour template sims at their declared 16 MB ceiling (≈ 55 MB), `page:composer` double-counted inside the measured
home claim (≈ 30–43 MB), l0 products (71 MB accounted vs 45 MB of GL the grid adds) and the home's texture mode (8 MB in
`img`, 29 MB in `ktx2`). Fixing the first two brings (M − E) / A to ≈ 1.03–1.06 without a window change. A Simulator soak
always loads images (the KTX2 probe vetoes the Simulator's compressed mips); a KTX2 reading needs the phone.

## Left
1. The model fix: measure a far-proxy template sim's resident cost; cover `page:composer` by a measured-runtime home claim
   (`coveredBy`, the allocator allows only commons today); then the l0 check and Driftwood's `imagesFirst` row.
2. The qualifying witness (pinned prepared-layout, see the SF57 row), the road-only leg, and the plain 30-minute public
   soak on current origin/main through sim-lane; its receipt in `progress/memory/sf57/public-<sha>/` must show the
   growth plateau after `1e428e7d7`.
3. Parity baselines for _template, far-reach, Nalati, Nine Dragon and Signal Dunes are red on HEAD `e4616421b` identically
   with and without `1e428e7d7` (stale baselines from other lanes, not SF57).

Plan-State: unchanged
