# Signal look, round 1: raw A / B (G345, sp-o24)

These are raw, unlabelled game screens for the plan desk's taste board. The Debug row is pause ▸ Settings ▸ Debug ▸
Look ▸ **Signal look** (`sunscar.look`, reload, default A), landed in `bb6291f57`.

- **A current:** the hand-written fire shaders (`runtime/looks/fireFx.ts`). These frames are pixel-identical to HEAD.
  The parity run compared `ae7304f04` with `bb6291f57` over 12 poses and matched on pixels, draws, triangles, GPU bytes,
  programs, shader sources and colliders.
- **B baked:** the same fires on standard materials (`world/fireBaked.ts`):
  - the flipbook on basic materials, turned to the camera on the CPU, with two pages half a book apart;
  - the glow as sprites, and the ground pool and the smoke column over radial textures baked once from `data/fire.ts`;
  - the embers as CPU-moved points (round dots that cool from hot to cool, not A's motion dashes).

  B loses A's book grade (the white core), the smoke's lean, curl and billow, and the ember dashes.
- Everything outside the fires is the same in A and B.

## The captures

Each file is named `<A|B>-<surface>-<pose>.png`.

- **Surfaces:** `phone` is the iPhone 16 Pro, portrait, DPR 2, phone tier. `desktop` is 1440 × 900, landscape, desktop
  tier.
- **State:** each capture is taken after `stage('waymarks-lit')` and `fire.light()`, with the dusk eased to the night
  (all four fires burning).
- **Poses:**
  - `waymark-fire`: a lit waymark brazier, with the tower fire on the left.
  - `tower-fire`: the signal fire on the tower deck and the keeper's lamp.
  - `spawn-tower`: the spawn crest looking 145 m to the tower.
  - `well`: the well.
  - `caravan-cookfire`: the caravan's lantern and the cookfire wisp.
  - `sand-dunes`: the sand looking back from the spawn.

**Not captured:** the grid seams and the near tier from the crossroads. B doesn't touch the sand tiles yet, so they
would be identical in A and B.

The script that made these is `capture.mjs`, kept beside this README.
