# Round 10 · dome B, round 8 (E169, 2026-09-25): the organic lab merged

Same cameras (`domeb-1…9`), same targets (`../round-10-dome-b-1/target-*.jpg`), private snapshot of the working tree on
`:5263` (dome A's round-8/9 state included: the P5 paint core, the new flagstones).

| File | What |
|---|---|
| `capture-1…9.jpg`, `capture-spawn.jpg`, `sheet-ingame-3x3.jpg` | round 8 |
| `eye-check.jpg` | **the new rule**: round 7 · round 8 · target for FP 1, 2, 6 and aerial 9, and the spawn round 7 · round 8 · **style-A (the ask)** |
| `walkaround-canopy.jpg` (+ `-cameras.json`) | the canopy's flat-card test: 5 eye-level frames round the tree, looking up into the crown |

## What changed since round 7

| # | Change | File |
|---|---|---|
| 1 | **The painted leaf-card canopy** (lab P7): `canopy.ts` copied from `nd-lab/organic/` (imports re-pointed, a `buildCanopy()` wrapper); dome B's banyan now plans its 55 shelves + 26 crown-fill lumps and draws no K.leaf ellipsoids (`BanyanSpec.leaves: false`, `banyanOut.plan`); main.ts dresses the lumps after the spill bake: a darker core + the cards (alpha to coverage, renderOrder 1) + the depth-equal pass writing each lump's plateau depth into the colour alpha (renderOrder 2). The alpha is the same `near / viewZ` dome A's post reads, so the ink draws clump outlines, not card edges or pin-holes (checked in 1, 2, 6, the spawn: no blotches) | `canopy.ts`, `banyan.ts`, `main.ts` |
| 2 | Dome B's leaf ramp, a step darker and less khaki than the lab's (`DOME_B_LEAVES`), the lit band 0.32 → 0.24: the lab's palette read #4c5742 (ΔE 10.2) against the targets' #343b32, the lit tops yellow from above | `canopy.ts` |
| 3 | **TRELLIS guardian lions** (`props3d.ts`, from the lab): on every third post of the Well's balustrade and both ends of the street's (those posts drop their lotus finial), and a pair ×2.4 on carved pedestals before the paifang's centre bay (`gate.ts lionPedestal`; the procedural `stoneLion` stays unused) | `props3d.ts`, `gate.ts`, `square.ts`, `layout.ts` |
| 4 | TRELLIS glazed pots west of the shrine and east of the gate; two TRELLIS lantern trios in the banyan (red paper glows) | `props3d.ts` |
| 5 | Kept dome B's own stall counter and mahjong tables (richer at dome B's cameras than the TRELLIS counter / sets; the TRELLIS sets bring stools that would double under the seated players). Kept dome B's root curtain (260 roots + 7 braided pillars; the lab's is 240 + 5) | — |
| 6 | Stone surfaces `SURF.stone` → `SURF.concrete` (the coordinator: a soft ink wash, not granite grain) on the Sumeru bases, drum stones, reliefs, planter rim, plaza lip, balustrade stone | `gate.ts`, `banyan.ts`, `square.ts` |
| 7 | Menu plaques on the stall's front beam (the back wall's menu specs reused: the shared colour atlas is full — a new sign spec crashed the page with "colour atlas full") | `stalls.ts` |

## Reverts (by eye, `eye-check.jpg` and the crops)

- **The stall-corner TRELLIS pot**: a cobalt blob in domeb-2's foreground. Removed (the other two pots stay).
- **The stall's back wall as a painted panel** (round 7's `K.panel` + wood paint): the frieze paint drew a big grey
  cloud scroll across the lit wall. Now a plain warm wash (`surf: SURF.none`), menus and shelves on it.
- **`SURF.stone` on the plinths / drum stones / planter** (round 7): granite grain at 10 m. Now `SURF.concrete`.

## ΔE00 (dome-B targets)

| Region | R1 | R4 | R7 | R8 |
|---|---|---|---|---|
| cinnabar | 16.7 | 2.5 | 2.4 | **2.4** |
| canopy | 26.7 | 4.8 | 4.2 | 5.9 (the cards bring lit leaves where the lumps were flat dark; 10.2 with the lab's palette) |
| roof tiles | 21.6 | 7.3 | 8.7 | 10.4 (dome A's tile paint + the lion / canopy changes in the region; no dome-B roof change) |
| stone | 8.9 | 4.7 | 4.4 | **4.4** |
| stall light | 9.3 | 5.7 | 6.7 | 8.3 (the plain back wall reads brighter than the panel did) |

By eye the canopy is the round's big win in every view that shows it (2, 6, 9, the spawn), whatever its mean colour.

## Rulers (quiet machine: load 4.2)

- ms/frame at 1206×2622, domeb-1 · 2 · 3: **12.7 · 12.3 · 6.3** (round 5: 11.7 · 11.5 · 6.1).
- Draw calls 72–100 (+6: canopy core, cards, cards-depth, lions, pots, lantern trios). Triangles 1.61–1.95 M per frame
  (+~150 k: the canopy ~57 k × the two card passes + core, lions 24 k × 14, pots 24 k × 2). Budget ≤ 200 calls, ≤ 2.5 M.

## Walk-around (the canopy)

`walkaround-canopy.jpg`: the tree stands in the square's north-east corner (walls north and east), so the walkable ring
is the arc from the gate round to the stall's front: 5 frames on it, looking up into the crown. No card reads flat from
any of them; the crown reads as painted leaf clusters with dark bellies. (Three ring positions fell inside the planter
and the north wall: dropped.)

## Open

- The canopy's lit tops still a touch bright from above (9) — tune `uWash` / the ramp's top once Jake has seen it.
- The roof-tile region's mean (10.4) — dome A's tile paint brightened the glaze; revisit the tile wash with dome A.
