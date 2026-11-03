# OP26 billboard re-shoot

**Complete, 2026-11-03, sp-x6:** all **243 core views** (27 billboards × 9),
with the original **51 red-tagged panels captured first**, plus **10
separate supplemental views**. Every comparison panel was read by eye.
Capture only: no visual source changes. No remaining board-plane
intersection was confirmed. This is **not a blanket 243-view green**:
framing and occlusion limits remain visible on the boards and below.

| Plot | Core views | Labelled before / now board |
|---|---:|---|
| Mosslight Ruins | 45 | [Board](mosslight-ruins/before-after-board.jpg) |
| Night Market | 45 | [Board, including separate rear diagnostic](night-market/before-after-board.jpg) |
| Frostline Peaks | 45 | [Board, including separate moved-board views](frostline-peaks/before-after-board.jpg) |
| Lantern Bayou | 36 | [Board](lantern-bayou/before-after-board.jpg) |
| Ember Forge | 36 | [Board](ember-forge/before-after-board.jpg) |
| Coral Drift | 36 | [Board](coral-drift/before-after-board.jpg) |

The core is pinned to **add58749dab8d20d3df8af657f1f5bc5389c14f1**,
build **add5874-mw0y4kqk**, containing OP26 **e0cc0a074b**. The original
review sheets are **8d810f14d7**, captured on **d3b32d2-mw0ppw9a**.
Per-plot `review.json` binds each frame/camera hash, board hash, verdict
and any interrupted-prefix provenance. All six boards are below 500 KB.

The original raw frames and exact camera inputs were deleted before
this task. The persisted `cameras.json` and per-board manifests
**reconstruct** the listed distances and board geometry, with eye heights
and three-quarter angles inferred from the review images. They are
**not recovered original camera bytes**. Before panels are crops of the
original labelled sheets; no exact-framing or pixel-parity claim is made.
Core cameras retain the old board centres/heights, even where OP26
intentionally moved a board. Supplementals never replace core frames.
Frostline plaza view 5 is green in the actual original sheet despite
the original prose listing it; the six red plaza tags are 1,3,4,6,8,9.
The selection follows the actual sheets and preserves 51 red panels.

## Observations and retained limits

Of the 243 core views, **195 show a clear observed face/frame**, **38
have relocation/framing limits**, **8 include a separate foreground
road post in the edge-on view**, and **2 are occluded**. These labels
describe what the frames establish, not a waiver of hidden geometry.
All 24 entry road approaches show the picture above the road wall/sign.
Mosslight's 19 originally red views show the old tree/ruin obstructions
absent. Ember's 36 views show no intersection. The visible surfaces of
all other boards show no confirmed intersection.

- **Night Market plaza rear, core view 7:** the original 12 m eye
  (-22,1.7,-28) is inside the retained stall at (-22,-27.5), outside the
  back strip ending at z -31.4 (sp-o3's exact placement trace). Keep the
  occluded frame. The separately approved **8 m rear** diagnostic,
  (-22,1.7,-32), inside the cleared strip, shows a clear rear face and
  no board-plane intersection. The coordinator ruled the 12 m stall
  occlusion is not a board clip unless that diagnostic shows one.
- **Frostline plaza:** the board intentionally moved from z -54 to -62.
  Core views 1,3,4,5,6,8 retain their old coordinates and cannot prove
  full clearance of the moved board. Core view 2 includes pine canopy.
  The approved **nine supplemental views translated 8 m south** retain
  every relative distance/angle and show eight clear observations.
  Supplemental view 2 remains pine-occluded: its front-25 m eye
  (-22,1.7,-87) is in the F-tile wood, near a clump at (-21,-84), outside
  the front strip ending at z -70.6 (sp-o3's source trace). No eye shift,
  hidden actor or replacement frame is used to turn it green.
- **Night Market and Coral entries:** OP26 moved the side offset from
  12.5 to 18 m. Fixed-original views 1,4,6,7 of each entry partly frame
  or miss the moved board; those 32 views stay inconclusive about the
  whole face. Front-25 m, the other oblique, overhead and road approach
  show clear surfaces. No physical clipping defect is inferred from a
  picture extending beyond a fixed camera's image edge.
- **Frostline and Bayou entry view 6:** a separate road post crosses the
  foreground of each edge-on camera. The billboard edge remains
  separate; no board-plane intersection is observed.

Supplementals use source **1e65bfaf43ff815fe7f847aa5935c3ab4aca063f**,
build **1e65bfa-mw0ywzkn**. Actual HTTP body audits match all other
Night Market 200 / Frostline 198 bodies to the core preview; only each
164 B look/map body changes its source-derived tilesHash. The map image
hashes remain exact. This is not literal whole-product byte identity.
The nine clear supplemental observations and one pine-occluded view
are labelled separately on their plot boards and in `review.json`.

## Capture and continuation

The existing `capturePlotDomes` loop owns all browser work. Its narrow
`viewSelection` support is **cbc6ed9976**: selected original view numbers,
explicit requested/completed scope and deferred boards for partial runs.
The normal nine-view board guard still refuses incomplete/duplicate sets.
Normal grid entry, physical anchors, shipping L0 residency, native
readiness/document/source checks, 2× phone rendering, 62° horizontal FOV,
120 drawn-frame settlement and the existing sample caps remain active.
Browsers are muted and closed. Both preview uses have been released.

Two release-priority interruptions preserve their rc143 and late
TargetClosed reports. Pre-signal checkpoints bind their already accepted,
hash-checked frames; errors are not erased. The completed core composition
is **51 + 99 + 64 + 29 = 243 unique views**, all on the same core build.
Only missing views resume. Completed first-51 / supplemental / final-29
commands took 1329 / 133 / 403 seconds. The interrupted 192-view and
93-view commands took 1081 / 752 seconds; those are interruptions, not
completed-scope timings. Supplementals and every core frame are read;
there is no remaining pending capture hidden behind the completion claim.
