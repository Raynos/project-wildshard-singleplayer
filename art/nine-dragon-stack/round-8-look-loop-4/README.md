# Round 8 · look loop 4 (E169, 2026-09-25): the wet ground combed with light

The fourth pass of dome A's 9-angle loop: anchor P = the spawn, the same cameras, `time(6.5)`, blue hour, no HUD,
against round 1's targets (`../round-8-look-loop-1/target-1…9.jpg`, Jake's pick). The captures export the shared
working tree, so dome B's gate and balustrade work shows in them too (the new paifang, the darker balustrade).

| File | What |
|---|---|
| `capture-1…9.jpg`, `sheet-ingame-3x3.jpg` | this round's frames (after round 3's fixes) |
| `board.jpg` | **BEFORE** (this round) \| **AFTER** (round 5) \| **TARGET** (round 1), FP 1, FP 6, aerial 7 |
| `warm-vs-cool.jpg`, `stats.txt` | A blue hour \| B warm silk; draws and triangles per camera |

## Gap list (capture → target)

1. FP front / right / back: the targets' wet ground is combed with many fine streaks, warm between the neon ones.
   Ours has a streak per sign, lantern and shopfront, and the stone between them is dark and empty.
2. Walls a shade darker than the targets now that the air is thinner (wall ΔE 1.3 → 2.3); the wet ground too (2.6 → 3.9).
3. Aerial square: the streaks run as long hard bars from every sign to the camera's foot.
4. Aerial shaft: the walls near the camera sit in the mid LOD, so there is no clutter; the shaft's top is lost in fog.
5. The balustrade (dome B) is darker than the target (stone ΔE 11.2).

## TOP fixes and what happened (round 5's captures)

| # | Gap | Track | Fix | Status |
|---|---|---|---|---|
| 1 | The wet ground's fine streaks | G | Every lit window below +28 m on a wall facing the square or the street's axis gets a streak card: 0.1 × its warm light, no spill. That adds 909 cards to the one instanced draw, 1,425 cards in all (`__nd.budget()` lists the count); 2 triangles each | Fixed: FP 1 / 3 / 4 read like the targets' combed ground. Streaks turn warmer (ΔE 3.8 → 4.5), so round 5 cuts the window cards to 0.07 and mixes 30 % white into them |
| 2 | Wet ground too dark | C | Wet flagstones 55 → 45 % darker where wet | Fixed (3.9 → 2.6) |
| 3 | Walls too dark | C | Facade wash `#d4d8e6` → `#dadeeb` | Partly (2.3 → 2.1); round 5 takes it to `#e0e3ef` |
| 4 | Bars in the aerial | G | Seen steeply (camera height / distance past 0.25), the streak tails shrink up to 40 % and the cards widen up to 50 %. Eye-height views are unchanged | Partly. The targets paint long streaks from above too, so the change stays mild |

ΔE per region (targets vs captures):

| Region | Round 3 | Round 4 | Round 5 |
|---|---|---|---|
| wall | 1.3 | 2.3 | 2.1 |
| wet ground | 2.6 | 3.9 | **2.6** |
| streaks (neon; not fitted) | 4.8 | 3.8 | 4.5 |
| stone (dome B) | 1.8 | 11.2 | 5.5 |
| silk sky | 4.4 | 1.8 | 1.7 |
| lit windows | 3.5 | 3.0 | 2.9 |
| cinnabar (dome B) | 3.9 | 0.7 | 0.8 |

## Rulers

- Draws 75–96 per frame (≤ 200); triangles 1.31–1.62 M (≤ 2.5 M) (`../round-8-look-loop-5/stats.txt`); the rise from
  1.54 M is mostly dome B's new gate.
- Frame time on round 4's build, 804×1748 on the M5 Max with the GPU quiet: the spawn 4.5–4.9 ms, the Well 2.6–3.3 ms.
- Gates: tsc is clean on the clean room. The one tsc error in the tree is in `src/dev/nd-lab/viewmodel` (P8's
  prototype). oxlint is clean.
