# Signal Dunes look loop 1 (round 10), 2026-10-01

Style: "Last Light" (`docs/design/sunscar-dunes/style-bible.md`). Captures: iPhone portrait 390×844 @3×, phone tier,
clean exports of HEAD + the lane (scratchpad `rev2.mjs`, plans h1f/h1l/h1r/h1b + `god` for TOP and the 4 diagonals,
portrait, HUD hidden). Targets: codex image_gen edits of the H1 captures with mockup C as the style reference; all 9
came back on the first take, none re-rolled.

| File | Shows |
|---|---|
| `board-before-after-target.jpg` | H1–H4 + the whip: before (fd94690e) · after loop 1 · target A–D |
| `h1-fp4-and-fire-chain.jpg` | H1 FP front/left/right/back; a lit waymark at 20 / 50 / 74 m; the signal column from the spawn |
| `sheet-h1-ingame-3x3.jpg`, `sheet-h1-ingame-3x3-r2.jpg` | H1's 9 angles in game, loop 1 r1 and r2 (sky fit) |
| `sheet-h1-target-3x3.jpg`, `target-h1-*.jpg` | the 9 targets |
| `h1-r1-r2-target.jpg` | FP front and diag front: r1 · r2 · target |
| `storm-and-boss.jpg` | the rise from the bowl, the Matriarch at 9 s, the old flat storm, the new streaked storm |

ΔE00, H1, pooled over the 9 frames (`scripts/palette-delta.py --regions <scratchpad regions>`):

| Region | r1 | r2 | r3 (thin streaks; FP re-shot, aerials from r2) |
|---|---|---|---|
| sand lit | 4.4 | 4.1 | 4.1 |
| sand shade | 1.4 | 1.4 | 1.4 |
| sky band | 10.8 | 4.7 | 4.2 |
| upper sky | 8.7 | 3.6 | 3.6 |

r2's clouds came out as puffy grey blobs (`h1-r1-r2-target.jpg`); r3 thinned them to streaks.

Gap list (targets vs r2), for loop 2: fine ripples everywhere, the aerials included (ours fade by 18 m); crisper crest
shadow edges (ours are vertex-resolution soft); more saturated lit faces (the means match, the spread doesn't); more
cloud texture in the band; the whip and glove (P3) and the black Matriarch (R6) still need models.
