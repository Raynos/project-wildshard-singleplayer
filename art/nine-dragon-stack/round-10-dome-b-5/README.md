# Round 10 · dome B, round 5 (E169, 2026-09-25)

Same cameras, same targets (`../round-10-dome-b-1/target-*.jpg`), private snapshot on `:5263`.

## What changed since round 4

| # | Gap (round 4) | Fix | Result |
|---|---|---|---|
| 1 | Crown over the gate's east bay (roots curtain the gate in 1, crown over the east roof in 9) | limb tips held east of x = banyan − 4.6 m (`banyan.ts`) | 1 clear; 9 still overlaps by perspective only |
| 2 | Canopy tops read as bright platters from above | light greens `#506a4a`… | canopy ΔE 4.8 → **4.2** |
| 3 | Balustrade panels plain (the targets' are carved) | `balustrade(…, carve)`: a relief dragon among clouds on every panel's face toward the square (`square.ts`; `well.ts`'s call is unchanged) | spawn frame's left edge, 3, 5 |
| 4 | Lanterns sparse over the square | two more lantern strings zig-zag over the north half (`square.ts`) | spawn, 1, 2, 7, 9 |
| 5 | Walk-through props | `walkable()`: drum stones, the shrine, the stele, the stall's tables (`layout.ts`) | — |

## ΔE00 (dome-B targets)

| Region | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|
| cinnabar | 16.7 | 7.5 | 2.8 | 2.5 | 2.8 |
| canopy | 26.7 | 5.9 | 4.9 | 4.8 | **4.2** |
| roof tiles | 21.6 | 26.5 | 11.1 | 7.3 | 7.8 |
| stone | 8.9 | 7.6 | 4.9 | 4.7 | 4.8 |
| stall light | 9.3 | 5.9 | 10.0 | 5.7 | 5.7 |

## Rulers

- Draw calls 70–92 (unchanged since round 1). Triangles 1.66–1.80 M per frame (+30 k: balustrade reliefs, lanterns).
- ms/frame at 1206×2622 (domeb-1 · 2 · 3): **11.7 · 11.5 · 6.1** (load average 7–12).

## Open (needs the labs or dome A)

- Canopy leaves (organic lab), stone lions (organic lab's TRELLIS lion), deeper carving and material texture on the
  plinths, planter and beams (texture lab). Flagstone size, puddles and warm light pools; the sky screen (dome A).
