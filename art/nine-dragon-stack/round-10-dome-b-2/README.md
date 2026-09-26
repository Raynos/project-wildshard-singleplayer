# Round 10 · dome B, round 2 (E169, 2026-09-25): after round 1's fixes

Same 9 cameras (`domeb-1…9`, anchor Q (13.0, +125, −13.0)), same targets (`../round-10-dome-b-1/target-*.jpg`), shot
from a private snapshot of the working tree (`:5263`, dome A's concurrent state included). What round 1 changed is in
`../round-10-dome-b-1/README.md` (TOP-10 table): new `gate.ts`, `banyan.ts`, `stalls.ts`; `square.ts` wiring, crowd,
balustrade; `layout.ts` STALL moved 0.5 m east / 0.6 m south.

| File | What |
|---|---|
| `capture-1…9.jpg`, `capture-spawn.jpg` | round 2 |
| `sheet-ingame-3x3.jpg` | rows: FP 1–3 · FP 4–6 + spawn · aerials 7–9 |
| `board.jpg` | BEFORE (round 1) · AFTER (round 2) · TARGET for FP 1, 2, 4, aerial 7, and the spawn before / after |

## ΔE00 per region (`palette-delta.py --regions ../round-10-dome-b-1/palette-regions.json`)

| Region | Round 1 | Round 2 |
|---|---|---|
| cinnabar (paifang lacquer) | 16.7 | **7.5** |
| canopy | 26.7 | **5.9** |
| roof tiles | 21.6 | 26.5 (worse: the new tile rolls are a bright jade, the targets a dark blue-teal `#33484c`) |
| stone (plinths, planter, drum stones) | 8.9 | 7.6 |
| stall light | 9.3 | **5.9** |

## Rulers

- Draw calls 70–92 per frame, unchanged (every new piece merges into its kit: paifang, banyan, stall, props).
- Triangles 1.09–1.19 M → 1.62–1.73 M per frame (budget ≤ 2.5 M). The whole-frame delta includes dome A's concurrent
  work; dome B's share, counted from the builders: canopy ~70 k, hanging + prop roots ~25 k, trunk ~20 k, gate tile
  rolls + soffits + dougong + drum stones ~80 k, stall ~15 k, +57 walkers ~78 k.
- ms/frame at 1206×2622: **not measurable this round** (load average 19–30 from the other lanes: 45–121 ms, noise).
  Re-measured on a quiet machine in a later round.

## Gap list (round 2 → target)

1. Paifang: tile roofs a flat bright jade from above (7, 8, 9) and from the front (1); the targets' glazed tiles are a
   dark blue-teal with rows that read. Lacquer still a touch bright (1, 3). Plinth panels carry ruled ruyi clouds, the
   targets carved relief (dragons, clouds) that reads as depth.
2. Banyan: the canopy's value is right now, but it is lumpy shelves of smooth blobs; the targets' crown is dense small
   leaves with a ragged edge. (The organic lab owns the leaf technique; merged when it lands.)
3. Stall: reads now (2, 4, 7, 9); the targets' is brighter inside with more steam and clutter above the counter.
4. Lanterns: the targets hang strings of lanterns across the gate bays and along the square; ours are sparse.
5. The square's flagstones (dome A's `style.ts`) and the sky screen (dome A) are the other large gaps in every frame.
