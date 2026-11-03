# Frostline Peaks · round 4 · the open items (OB3, 2026-11-03, sp-o3)

What the look loop's final board left open (`../round-2-look-loop/README.md`, "Still open"): no long blue shadows on the
snow, a sky lighter than round 62's cobalt, and an open plaza where round 62 hugs the peak with pines. Taken over from
sp-o1 on wildshard-new's word.

`board.jpg`: BEFORE (HEAD 92611f473e) · AFTER (round 2 below) · TARGET (the look loop's T0 targets; the road row's is
round 62's road-entry panel) at the loop's own angles (`nine.mjs`, from sp-o1's: P = (0, -75), plus the road entry),
entered from the SHARD SELECT card on the phone tier at 2x as an iPhone 16 Pro.

## What changed

- **Blue shadows.** The phone draws no cast shadows here, so they are baked: each pine clump and lodge lays its shadow
  on the snow (`shadow`, `src/shards/open-plots/generators/frost.mjs`), the hull of its footprint and that footprint
  moved down the shadow, in the layout's `snowShadow` blue, paler toward its far end. The look pins a low morning sun
  (7.5° up, from the north-east: the day row's 0.72 and azimuth 71), so the shadows fall south-south-west
  (`shadows.dir`), 2.4 times the piece's height (`shadows.length`; the true 7.6 times would cross whole tiles). They lie
  in the kit's draw 3 cm over the ground, ruled as it is, and stop at their tile's edge, so none lies over a canal.
- **Cobalt.** The look key's zenith 0.03 / 0.14 / 0.58 → 0 / 0.03 / 0.30, horizon 0.45 / 0.64 / 0.95 → 0.12 / 0.30 /
  0.75, fog 0.62 / 0.76 / 0.96 → 0.30 / 0.48 / 0.85 (the row, its template and its recipe together). The top of the road
  frame reads 76 / 121 / 176 (was 132 / 159 / 189).
- **Pines round the plaza.** Twelve three-tree clumps of the kit's pines (`plazaPines`, one quarter mirrored into four)
  on the plaza between the peak's foot (46 m) and its edge, clear of the four entries, the lift base and the poster,
  with their shadows. Sixteen larger clumps cost 105 KB of phone wire and went past the plaza tiles' resident debt; these
  fit inside it.

## Numbers

- Draws identical at all six views (108 / 104 / 106 / 118 / 134 / 144, standalone, Chromium); triangles +3k to +15k.
- Phone wire 6,712,752 → 6,790,224 B (+77.5 KB, under the +100 KB a round standing rule). No new tile debt.

## Ruling (G872, sp-o3)

- **R1:** zenith 0.012 / 0.07 / 0.42 and shadows in #9db4dc. The sky barely moved (132 / 159 / 189 → 111 / 143 / 184)
  and the shadows read faint.
- **R2 ships:** the values above and shadows in #7f9ccf. The road entry reads cobalt, the pines throw long blue shadows
  seen from the air and lay a blue patch at eye level, and the plaza's south side gains its pines. Still apart from the
  targets: the snow reads grey-white rather than bright, and the shadows are softer than T0's crisp bands.
