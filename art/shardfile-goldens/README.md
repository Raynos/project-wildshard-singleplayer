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
