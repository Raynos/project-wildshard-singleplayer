# hud / round-25-declared-panels: shard panels on the platform's declared panels (SF28)

Not a pick: proof for SHARD-PLATFORM SF28 ("no shard builds DOM; each panel is declared"). The look must not change.

| File | What it shows |
|---|---|
| `pine-board-closed-{before,after}.jpg` | Pine Hollow at spawn, the lodge board closed |
| `pine-board-open-{before,after}.jpg` | the lodge's contract board open (the quest handle's `openBoard`): before, Pine's hand-built `BoardPanel`; after, the declared frame + `boardRows(board)` |
| `nalati-stealth-{detected,noticed}-{before,after}.jpg` | Nalati's stealth layer frozen in DETECTED / NOTICED (the `nalati.stealth` handle): the phone's status row with the eye icon (now SVG data), the threat chevron, the TALL GRASS chip |
| `compare.json` | differing pixels per pair, PNGs of the HUD alone (3D canvas hidden) at 1206 × 2622 and per-element clips |

**Result:** every panel frame and clip is pixel-identical (0 differing pixels: board closed, board open, its frame,
stealth DETECTED, the status row and the chip in both states). The one full-frame difference (95 px in
`nalati-stealth-noticed`) is the quest chip's bearing arrow at 1108–1125 × 423–439, which turns with the live view and
is not a converted panel.

**How they were made** (2026-10-09, op-panels, ask E435): `capture.mjs` through `scripts/browser-lane.sh`, Chromium as
an iPhone 16 Pro (402 × 874 @3×, portrait, touch, muted) against `scripts/serve-build.sh --rev` builds of `913264c38`
(before) and `27fe1ea5b` (after); `compare.py <png dir>` writes `compare.json`. The markup proof for every converted
panel, including the ones not captured here (the horse-name box, the portal veil, the trophy tip), is
`test/declared-panels.test.ts`: each declared panel equals the replaced hand-built markup.
