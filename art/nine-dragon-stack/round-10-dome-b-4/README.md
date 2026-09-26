# Round 10 · dome B, round 4 (E169, 2026-09-25)

Same cameras (`domeb-1…9`), same targets (`../round-10-dome-b-1/target-*.jpg`), private snapshot on `:5263`.
`board.jpg`: ROUND 1 · ROUND 4 · TARGET for FP 1, 2, 6 and aerial 9, and the spawn frame round 1 vs round 4.

## What changed since round 3

| # | Gap (round 3) | Fix | Result |
|---|---|---|---|
| 1 | Roof tiles a shade bright | pans `#0e1b1e`, rolls `#213434` | tiles ΔE 11.1 → **7.3** |
| 2 | Banyan small and slim in the spawn frame; crown buried in the north / east blocks | height 12.5 → 14 m, spread 8.2 → 8.6; every limb tip shifted 1.4 m W / 1.6 m S and pulled back out of the walls; the crown fill follows | the crown now rises right of the gate in the spawn frame (style-A's composition) |
| 3 | Stall light overshot | back wall emit 0.24 → 0.18 | stall light ΔE 10.0 → **5.7** |

## ΔE00 per region (dome-B targets)

| Region | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| cinnabar | 16.7 | 7.5 | 2.8 | **2.5** |
| canopy | 26.7 | 5.9 | 4.9 | **4.8** |
| roof tiles | 21.6 | 26.5 | 11.1 | **7.3** |
| stone | 8.9 | 7.6 | 4.9 | **4.7** |
| stall light | 9.3 | 5.9 | 10.0 | **5.7** |

## Rulers (whole frame, the working tree incl. dome A's state)

| | Round 1 | Round 4 |
|---|---|---|
| draw calls | 70–93 | 70–92 |
| triangles / frame | 1.09–1.19 M | 1.63–1.77 M (budget ≤ 2.5 M) |
| ms/frame at 1206×2622 (spawn · domeb-1 · domeb-2) | — · 16.1 · 15.1 (load 3.5) | **15.1 · 9.5 · 8.3** (load 8.6) |

The frame got faster while dome B added ~0.3 M triangles (dome A's pipeline work in the same tree): dome B's props are
not the frame's cost. Every dome-B piece merges into an existing kit (paifang, banyan, stall, props): no new draw call.

## Gap list → round 5

1. The banyan's crown now overhangs the gate's east bay: its roots curtain the gate in 1 and the crown covers the east
   roof in 9. The targets keep the tree right of the gate. → tips held east of the gate (x ≥ cx − 4.6).
2. The canopy's lit tops read as bright green platters from above (9). → the light greens darker.
3. The canopy is lumps, not leaves: waiting for the organic lab's leaf technique (and its TRELLIS lion for the gate).
4. Carved relief reads as texture only at 10–15 m; the targets' plinths carry deeper, larger carving (a texture-lab job:
   normal / AO detail, merged when round-9-lab-texture lands).
5. Ground (flagstone size, puddles, warm light pools) and the sky screen: dome A's lane.
