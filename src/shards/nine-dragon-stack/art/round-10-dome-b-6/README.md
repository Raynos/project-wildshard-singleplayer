# Round 10 · dome B, round 6 (E169, 2026-09-25): the proof in the hero frame

Same cameras, same targets, private snapshot on `:5263`. `board.jpg`: **spawn round 1 · spawn round 6 · the style-A
mockup**, then FP 1 and aerial 9 as round 1 · round 6 · target.

This round read dome A's spawn frame against the style-A mockup side by side (the spawn is where dome B has to land):
the gate read squat and roof-heavy, a band of umbrellas filled the frame's foreground, and a lantern string crossed
its sky.

## What changed since round 5

| # | Gap | Fix | Where it shows |
|---|---|---|---|
| 1 | Gate squat and roof-heavy (1.4 m posts, roofs a third of the height) | posts 0.32 s / 0.26 s (were 0.38 / 0.30); main roof w bay + 2.4 s (was + 3.2 s), d 2.6 s, h 1.55 s; side roofs w + 0.6 s, h 1.15 s, their bracket rows stop short of the centre posts (`gate.ts`) | spawn, 1, 7, 9: the tall bays open under light roofs, the 九龍 plaque reads |
| 2 | The spawn's foreground crowded (style-A: the crowd is mid-distance, under the gate) | the crowd's placement keeps a 14 m cone in front of the spawn open; the centre zone 26 → 18 walkers (`square.ts`) | spawn |
| 3 | A lantern string across the spawn's sky | the string nearest the spawn removed | spawn |
| 4 | Balustrade finials read as onion domes | lotus-bud finials: a petal collar, the bud swelling to a point, 12 sides | spawn's left edge, 3, 5 |

## ΔE00 (dome-B targets)

| Region | R1 | R2 | R3 | R4 | R5 | R6 |
|---|---|---|---|---|---|---|
| cinnabar | 16.7 | 7.5 | 2.8 | 2.5 | 2.8 | **2.5** |
| canopy | 26.7 | 5.9 | 4.9 | 4.8 | 4.2 | **4.2** |
| roof tiles | 21.6 | 26.5 | 11.1 | 7.3 | 7.8 | 8.8 |
| stone | 8.9 | 7.6 | 4.9 | 4.7 | 4.8 | **4.5** |
| stall light | 9.3 | 5.9 | 10.0 | 5.7 | 5.7 | **5.7** |

(Roof tiles 7.8 → 8.8: the smaller roofs leave more of the region to the towers behind; the tile colour is unchanged.)

## Rulers

- Draw calls 70–92 (unchanged since round 1). Triangles 1.64–1.79 M per frame.
- ms/frame: load average 13–14 this round (35–56 ms, noise); round 5's quiet reading stands: **11.7 · 11.5 · 6.1 ms**
  at 1206×2622 on domeb-1 · 2 · 3.

## Open

Canopy leaves and the stone lions (organic lab), carving depth and material texture (texture lab); flagstones, light
pools and the sky screen (dome A).

## Walk-around (LOOK-LOOP: no look that only works from 9 cameras)

`walkaround.jpg`: 12 eye-level frames on a ring round the gate / banyan / stall cluster, all looking at (11.5, −21.5),
including three from the street north of the gate looking back at its north face (`walkaround-cameras.json`). No
cut-outs, no open backs, no seams: the gate's north face carries its own plaque and couplets, the stall reads from its
front-east corner (the lit name board, the counter, the diners), the banyan's trunk, pillars and root curtains read
from every side. Weakest up close: the drum stones' beasts (lumps from 3 m) — the organic lab's TRELLIS lion is the fix.
