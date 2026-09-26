# Round 10 · dome B, round 7 (E169, 2026-09-25): the P5 paint on dome B's surfaces

Same cameras, same targets, private snapshot on `:5263` (dome A's merge of the P5 paint core included: `paint.ts`,
the painted flagstones — 0.62 m courses × 0.64–0.92 m stones with puddles — the painted concrete, tiles and frieze).
`board.jpg`: spawn round 1 · round 7 · the style-A mockup; FP 2 and aerial 7 as round 1 · round 7 · target.

## What changed since round 6

| # | Fix | File |
|---|---|---|
| 1 | `surf: SURF.lacquer` on the paifang's lacquer (posts, beams) and the shrine's cabinet; weathered lacquer streaks under the ink | `gate.ts`, `banyan.ts` |
| 2 | `surf: SURF.stone` on the Sumeru bases, drum stones (block, drum, rings, bosses, knob), the carved reliefs, the (off) lions, the planter rim, the plaza lip | `gate.ts`, `banyan.ts`, `square.ts` |
| 3 | `surf: SURF.wood` on the stall's timber (counter front, side boards, back wall) and new timber bar stools (were the hero lab's plastic stool) | `stalls.ts` |
| 4 | The balustrade panels, the Sumeru dies and the stall's panels take the painted frieze / lacquer automatically (kind 5 by size); the tile roofs take the painted glaze (kind 2) | — |
| 5 | One walker in ten under a red oil-paper umbrella, one in ten under an ochre one (`crowd.ts tintUmbrella`, wired in `main.ts`; +2 instanced draws) | `crowd.ts`, `main.ts` |
| 6 | The drum stones' procedural beast (a lump from 3 m in the walk-around) → a lotus-bud knob | `gate.ts` |

## ΔE00 (dome-B targets) — the paint is a detail ratio (mean 1), so the region means hold

| Region | R1 | R4 | R6 | R7 |
|---|---|---|---|---|
| cinnabar | 16.7 | 2.5 | 2.5 | **2.4** |
| canopy | 26.7 | 4.8 | 4.2 | **4.2** |
| roof tiles | 21.6 | 7.3 | 8.8 | **8.7** |
| stone | 8.9 | 4.7 | 4.5 | **4.4** |
| stall light | 9.3 | 5.7 | 5.7 | 6.7 |

## Rulers

- Draw calls 72–94 (+2: the two umbrella variants). Triangles 1.64–1.79 M per frame.
- ms/frame: load average 14–22 this round (37–49 ms: noise). Last quiet reading (round 5): 11.7 · 11.5 · 6.1 ms.

## Open

The canopy is still lumps (the organic lab's leaf canopy), the lions wait for the organic lab's TRELLIS lion.
