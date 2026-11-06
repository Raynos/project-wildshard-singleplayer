# Round 8 · look loop 8 (E169, 2026-09-25): the P5 paint merged, smaller flagstones

Dome A's eighth set of frames: anchor P = the spawn, the same 9 cameras, `time(6.5)`, blue hour, no HUD, against
round 1's targets (`../round-8-look-loop-1/target-1…9.jpg`). The frames export the shared working tree, so dome B's
work in progress on the gate, banyan, crowd and balustrade shows in them too.

| File | What |
|---|---|
| `capture-1…9.jpg`, `sheet-ingame-3x3.jpg` | the frames |
| `warm-vs-cool.jpg`, `stats.txt` | A blue hour \| B warm silk; draws and triangles per camera |
| `../round-8-look-loop-7/board.jpg` | round 7 \| this round \| the target, FP 1, FP 6, aerial 7 |
| `mock-A…D.jpg`, `sheet-mockups.jpg` | (added in round 9, same build) the four round-6 mockup views with the HUD: spawn, well-edge, stair-street, well-down \| mockup |
| `board.jpg` | this round \| round 9 (the repair) \| the target, FP 1, FP 6, aerial 7 |

## What changed since round 7

1. **Lab P5's paint core is merged** (`round-9-lab-texture/README.md`). It lives in `paint.ts`, a copy of the lab's
   module. The textures stay at `public/assets/nine-dragon/lab/tex/`. Surfaces multiply their wash by a painted detail
   ratio (mean 1) before the ink is composed:
   - flagstones: painted granite per stone, whose cavity deepens puddles, with a sky sheen in the wet dabs;
   - the Jiehua facade cells: painted concrete;
   - glazed tiles: on the texture's pitch;
   - panels: the carved frieze on balustrade-sized faces, lacquer on painted boards, planks on `surf: wood`, plain
     stone otherwise;
   - bare stone (kind 9): painted stone;
   - the facade program: painted concrete on every concrete-ish surface (world-anchored), tiles on the pitch;
   - the wet-ground streaks break on the paint's wet and dry dabs;
   - rain rivulets on wet vertical faces, added to the clean room's own wet block. The lab's wet darkening was not
     ported: the clean room has its own.
   - `Look.surf` (flag bits × 4096; `SURF` in `paint.ts`) selects a surface explicitly. Dome B marks its own surfaces
     (lacquer, wood, stone) with it.
   - `__nd.paint([master, flags, walls, wood])` is the debug hook; `[0, 1, 1, 1]` turns the paint off.
2. **Smaller flagstones** (dome B's ask; its biggest gap in all 9 of its frames): courses 0.82 → 0.62 m, stones
   1.05–1.6 → 0.64–0.92 m, in a running bond. The layout is written once (`paint.ts FLAG`, `flagCell()`), and the
   ground's joints, the streak cards and the paint's per-stone windows all read it.

## ΔE per region (targets vs captures)

| Region | Round 1 | Round 7 | Round 8 |
|---|---|---|---|
| wall | 6.3 | 2.1 | 2.1 |
| wet ground | 3.4 | 2.2 | **1.5** |
| streaks (neon; not fitted) | 6.0 | 4.0 | 4.0 |
| stone (dome B's balustrade, now painted) | 12.3 | 5.7 | **3.5** |
| silk sky | 3.7 | 1.7 | 1.6 |
| lit windows | 2.1 | 3.2 | 2.9 |
| cinnabar (dome B's gate) | 7.5 | 0.8 | 1.9 |

The paint keeps each region's mean by construction; what moved is the wet ground and stone, which get darker, bluer
wet dabs. FP 6 now reads close to the target's wet granite (see the board).

## Open

- **The balustrade tops and the Well lip** (kind 9 stone) show the painted stone strongly in FP 2 / FP 6. It is dome
  B's stone; the paint strength is `uPaintK.z` (walls: stone, concrete, panel).
- **Aerial square:** the lamp-lit depth and contrast (P6).
- **Sky screens:** the painting (P7's scroll).
- **Viewmodel and grapple:** P8 and P9.

## Rulers

- Draws 79–97 per frame (≤ 200); triangles 1.51–1.78 M (≤ 2.5 M): the paint adds no draws and no triangles.
- Frame time: not measurable. Load average was 10–13 while this was measured; the spawn read 44 ms against a quiet
  4.5–4.9 ms on round 4's build. Interleaved paint on / off: the spawn 44.6 / 44.8 ms, FP 2 31.4 / 26.3, FP 3 33.9 / 27.5
  (medians of 6 × 20 frames). The lab measured +0.00–0.10 ms on a quieter GPU.
- Download: +3.65 MB of JPEGs. GPU memory: 50 MB as RGBA8; the lab's shipping note is a KTX2 array, 12.6 MB as ASTC.
- Gates: the clean room typechecks clean on its own. The whole-tree tsc run fails on a clash: the P6 light lab's
  `src/dev/nd-lab/light/room/main.ts` also declares `Window.__nd`. oxlint's one error in `nine-dragon/main.ts` comes
  from the same clash.
