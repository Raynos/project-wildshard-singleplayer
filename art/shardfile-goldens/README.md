# SHARDFILE goldens (G859)

The SHARDFILE reference frames that replace the LEGACY goldens as the look to hold (G859, G873 L5).
`art/legacy-goldens/` stays the frozen record of LEGACY. `<shard>/24/<nn>-<camera>.jpg` is one frame per camera:
24 cameras per shard (`art/legacy-goldens/compare/cameras24.json`), six shards, 144 frames. Each frame has a burned-in
label strip naming the shard, the camera and the source.

## Source

- The clean 144-camera rerun on `744c3ab7e2e2faf36176e411da1ce9808cb13aa0`, captured 2026-10-29 with
  `art/legacy-goldens/compare/capture.mjs --mode=shardfile` (muted Chromium through `scripts/browser-lane.sh`, iPhone 16
  Pro portrait, phone tier, render scale 2x, seed 357, midday / clear), the same protocol as the LEGACY goldens.
- Verdicts: wildshard-v's `fa2c2849d8` (`art/legacy-goldens/compare/verdicts.json`), 141 / 144 great against LEGACY.
  The three left at the rerun: Nine 17 / 18 (QA6, the lower skyline of lit towers; being fixed after this capture) and
  Far Reach 8 (QA7, closed by decision `69db68c0ff`: LEGACY's clump there was grass hanging over the void).
- Re-encoded from the rerun's 540 x 915 frames with a 22 px label strip, JPEG quality 72 (each frame under 130 KB).

## Updates

- 2026-11-03, far-reach 24 (hands up): refreshed from `0d7a022fbb` (G992, the sun disc and its additive halo removed
  from data-look skies). The halo washed the bridge white whenever the live clock's low sun stood behind it; without it
  the frame is stable. Cam 16 (rim crown north) is kept: its delta is the storm crown animating between visits, equal
  before and after G992. Board: `../golden-runs/far-reach/2026-11-03-0d7a022fbb-g992-board.jpg`.
- 2026-11-03, nine-dragon-stack 01-08, 14, 19, 23, 24: refreshed for QD3 (G995, ruled B under G941: the wet-ground
  neon streaks sit at each light's own mirror point, only for lights on screen, as a short gloss fading from 15 m to
  nothing at 50 m; board `../nine-dragon-stack/round-51-qd3-streaks/`). Captured on `592dc655ea` + the QD3 change,
  Chromium; WebKit matched. Boards: `../golden-runs/nine-dragon-stack/2026-11-03-592dc655ea-qd3{,-webkit}-board.jpg`.
